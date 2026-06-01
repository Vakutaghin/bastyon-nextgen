import type {
  Transcoder,
  TranscodeCodec,
  TranscodeOptions,
  TranscodeProgress,
  TranscodeResult,
  VideoMetadata,
} from './types'
import { TranscodeError } from './types'
import {
  selectTargetResolution,
  calculateTargetDimensions,
  getResolutionString,
} from './resolution-selector'
import {
  MAX_VIDEO_BITRATE,
  MAX_AUDIO_BITRATE,
  TARGET_FPS,
  MAX_FPS,
  getBitrateForResolution,
} from '../utils/constants'
import { isTauri } from '../utils/environment'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Tauri транскодер
 * Использует Tauri команды для транскодирования видео через FFmpeg на стороне Rust
 * Самый быстрый и надежный способ транскодирования
 */
export class TauriTranscoder implements Transcoder {
  readonly kind = 'tauri' as const

  /**
   * Проверить поддержку
   */
  isSupported(): boolean {
    return isTauri()
  }

  /**
   * Проверить, установлены ли системные ffmpeg/ffprobe.
   * Запускается один раз при инициализации UI uploader'а, чтобы показать инструкцию
   * по установке ДО того, как пользователь упрётся в "Failed to execute ffprobe".
   */
  async checkFfmpegAvailable(): Promise<{
    ffmpeg: boolean
    ffprobe: boolean
    ffmpegVersion: string | null
  }> {
    if (!this.isSupported()) {
      return { ffmpeg: false, ffprobe: false, ffmpegVersion: null }
    }
    try {
      const result = await invoke<{
        ffmpeg: boolean
        ffprobe: boolean
        ffmpeg_version: string | null
      }>('check_ffmpeg_available')
      return {
        ffmpeg: result.ffmpeg,
        ffprobe: result.ffprobe,
        ffmpegVersion: result.ffmpeg_version,
      }
    } catch {
      return { ffmpeg: false, ffprobe: false, ffmpegVersion: null }
    }
  }

  /**
   * Получить метаданные видео по File (для standalone-вызовов).
   * Сохраняет файл во временную директорию, читает метаданные, удаляет.
   * Внутри transcode() предпочтительнее getMetadataByPath() — там путь уже есть.
   */
  async getMetadata(file: File): Promise<VideoMetadata> {
    if (!this.isSupported()) {
      throw new TranscodeError('Tauri is not available', 'NOT_SUPPORTED')
    }

    let filePath: string | null = null
    try {
      filePath = await this.saveFileToTemp(file)
      return await this.getMetadataByPath(filePath)
    } catch (error) {
      throw new TranscodeError('Failed to get video metadata', 'METADATA_ERROR', error as Error)
    } finally {
      if (filePath) {
        // Не блокируем основной флоу, если cleanup упал — TTL-сборщик подберёт
        invoke('delete_temp_file', { filePath }).catch(() => {})
      }
    }
  }

  /**
   * Прочитать метаданные напрямую из готового пути на диске — без сохранения/удаления.
   * Используется внутри transcode(), чтобы не копировать большой файл повторно.
   */
  private async getMetadataByPath(filePath: string): Promise<VideoMetadata> {
    const metadata = await invoke<{
      width: number
      height: number
      duration: number
      fps: number
      has_audio: boolean
      video_bitrate?: number
      audio_bitrate?: number
      mime_type?: string
    }>('get_video_metadata', { filePath })

    return {
      width: metadata.width,
      height: metadata.height,
      duration: metadata.duration,
      fps: metadata.fps,
      hasAudio: metadata.has_audio,
      videoBitrate: metadata.video_bitrate,
      audioBitrate: metadata.audio_bitrate,
      mimeType: metadata.mime_type,
    }
  }

  /**
   * Транскодировать видео.
   *
   * Файл копируется во временную директорию ровно один раз; метаданные читаются с того
   * же пути (без повторного save/delete), результат удаляется в finally вместе с входом —
   * чтобы ничего не утекало даже при ошибке.
   */
  async transcode(
    file: File,
    options: TranscodeOptions = {},
    onProgress?: (progress: TranscodeProgress) => void
  ): Promise<TranscodeResult> {
    if (!this.isSupported()) {
      throw new TranscodeError('Tauri is not available', 'NOT_SUPPORTED')
    }

    let inputFilePath: string | null = null
    let outputFilePath: string | null = null
    let progressUnlisten: (() => void) | null = null

    try {
      // Один save файла на весь transcode-цикл — экономит 2× копирования для 4GB файлов
      inputFilePath = await this.saveFileToTemp(file)

      // Метаданные читаем с уже сохранённого пути, без повторного save
      const metadata = await this.getMetadataByPath(inputFilePath)

      // Определяем целевое разрешение
      const targetResolution =
        options.resolution || selectTargetResolution(metadata.width, metadata.height)
      const { width, height } = calculateTargetDimensions(
        metadata.width,
        metadata.height,
        targetResolution
      )

      // Определяем параметры кодирования
      const sourceBitrate = metadata.videoBitrate
        ? metadata.videoBitrate
        : Math.round((file.size * 8) / (metadata.duration * 1000))

      const calculatedBitrate = options.videoBitrate || getBitrateForResolution(targetResolution)
      const videoBitrate = Math.min(
        calculatedBitrate,
        MAX_VIDEO_BITRATE,
        sourceBitrate > 0 ? sourceBitrate : Infinity
      )
      const fps = Math.min(options.fps || TARGET_FPS, MAX_FPS)
      const codec: TranscodeCodec = options.codec ?? 'h264'

      const audioBitrate = metadata.hasAudio ? options.audioBitrate || MAX_AUDIO_BITRATE : 0

      if (onProgress) {
        progressUnlisten = await listen<{
          progress: number
          currentTime: number
          duration: number
        }>('transcode-progress', (event) => {
          onProgress({
            progress: event.payload.progress,
            framesProcessed: undefined,
          })
        })
      }

      // Tauri автоматически конвертирует camelCase в snake_case для Rust
      const result = await invoke<{
        output_path: string
        width: number
        height: number
        duration: number
        file_size: number
      }>('transcode_video', {
        inputPath: inputFilePath,
        outputPath: '',
        width,
        height,
        videoBitrate,
        audioBitrate,
        fps,
        hasAudio: metadata.hasAudio,
        duration: metadata.duration,
        codec,
      })

      outputFilePath = result.output_path

      // Получаем Blob через asset URL (передача байтов через IPC падает с "object can not be cloned")
      const assetUrl = convertFileSrc(outputFilePath)
      const response = await fetch(assetUrl)
      if (!response.ok) {
        throw new Error(`Failed to read transcoded file: ${response.status}`)
      }
      const blob = await response.blob()

      const mimeType = codec === 'vp9' ? 'video/webm' : 'video/mp4'
      return {
        blob,
        width: result.width,
        height: result.height,
        resolution: getResolutionString(targetResolution),
        videoBitrate,
        audioBitrate,
        fps,
        hasAudio: metadata.hasAudio && !!audioBitrate,
        mimeType,
        duration: result.duration,
      }
    } catch (error) {
      if (error instanceof TranscodeError) {
        throw error
      }
      const err = error as Error
      const msg = err?.message || String(error)
      throw new TranscodeError(msg || 'Failed to transcode video', 'TRANSCODE_ERROR', err)
    } finally {
      if (progressUnlisten) {
        progressUnlisten()
      }
      // Cleanup даже при ошибке — иначе temp засоряется на каждом сбое
      if (inputFilePath) {
        invoke('delete_temp_file', { filePath: inputFilePath }).catch(() => {})
      }
      if (outputFilePath) {
        invoke('delete_temp_file', { filePath: outputFilePath }).catch(() => {})
      }
    }
  }

  /**
   * Сохранить файл во временную директорию через Tauri
   * Использует Web Worker для чтения больших файлов, чтобы не блокировать UI
   */
  private async saveFileToTemp(file: File): Promise<string> {
    try {
      // Для файлов больше 5MB используем Worker, чтобы не блокировать UI
      let data: number[]

      if (file.size > 5 * 1024 * 1024) {
        // > 5MB
        // Используем Worker для больших файлов (до 4GB)
        data = await this.readFileInWorker(file)
      } else {
        // Для маленьких файлов читаем напрямую
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        data = Array.from(uint8Array)
      }

      const filePath = await invoke<string>('save_temp_file', {
        fileName: file.name,
        data,
      })

      return filePath
    } catch (error) {
      throw new TranscodeError('Failed to save file to temp', 'FILE_SAVE_ERROR', error as Error)
    }
  }

  /**
   * Читать файл в Web Worker
   * Для больших файлов (до 4GB) обрабатывает порциями, чтобы не блокировать UI
   */
  private async readFileInWorker(file: File): Promise<number[]> {
    // Сначала читаем файл в ArrayBuffer в основном потоке
    // (это необходимо, так как File нельзя передать в Worker напрямую)
    // Для очень больших файлов это может занять время, но это неизбежно
    const arrayBuffer = await file.arrayBuffer()

    return new Promise((resolve, reject) => {
      // Создаем Worker динамически
      const worker = new Worker(new URL('./file-worker.ts', import.meta.url), { type: 'module' })

      const timeout = setTimeout(() => {
        worker.terminate()
        reject(new Error('File reading timeout'))
      }, 600000) // 10 минут таймаут для очень больших файлов (до 4GB)

      worker.onmessage = (event: MessageEvent) => {
        const { type, payload } = event.data

        if (type === 'FILE_READ') {
          clearTimeout(timeout)
          worker.terminate()
          resolve(payload.data)
        } else if (type === 'FILE_READ_PROGRESS') {
          // Игнорируем прогресс чтения (можно использовать для отображения, если нужно)
        } else if (type === 'ERROR') {
          clearTimeout(timeout)
          worker.terminate()
          reject(new Error(payload.error))
        }
      }

      worker.onerror = (error) => {
        clearTimeout(timeout)
        worker.terminate()
        reject(error)
      }

      // Отправляем ArrayBuffer в Worker через Transferable для эффективности
      // Это передает владение ArrayBuffer в Worker, освобождая память в основном потоке
      worker.postMessage(
        {
          type: 'READ_FILE',
          payload: { arrayBuffer },
        },
        [arrayBuffer]
      )
    })
  }

  /**
   * Уничтожить транскодер и освободить ресурсы
   */
  destroy(): void {
    // Tauri транскодер не требует очистки
  }
}
