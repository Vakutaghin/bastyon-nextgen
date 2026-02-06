import type {
  Transcoder,
  TranscodeOptions,
  TranscodeProgress,
  TranscodeResult,
  VideoMetadata
} from './types'
import { TranscodeError } from './types'
import { selectTargetResolution, calculateTargetDimensions, getResolutionString } from './resolution-selector'
import {
  MAX_VIDEO_BITRATE,
  MAX_AUDIO_BITRATE,
  TARGET_FPS,
  MAX_FPS,
  getBitrateForResolution
} from '../utils/constants'
import { isTauri } from '../utils/environment'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Tauri транскодер
 * Использует Tauri команды для транскодирования видео через FFmpeg на стороне Rust
 * Самый быстрый и надежный способ транскодирования
 */
export class TauriTranscoder implements Transcoder {
  /**
   * Проверить поддержку
   */
  isSupported(): boolean {
    return isTauri()
  }

  /**
   * Получить метаданные видео
   */
  async getMetadata(file: File): Promise<VideoMetadata> {
    if (!this.isSupported()) {
      throw new TranscodeError('Tauri is not available', 'NOT_SUPPORTED')
    }

    // Используем Tauri команду для получения метаданных
    try {
      const filePath = await this.saveFileToTemp(file)

      const metadata = await invoke<{
        width: number
        height: number
        duration: number
        fps: number
        has_audio: boolean
        video_bitrate?: number
        audio_bitrate?: number
        mime_type?: string
      }>('get_video_metadata', {
        filePath
      })

      // Удаляем временный файл
      await invoke('delete_temp_file', { filePath })

      // Конвертируем в VideoMetadata
      return {
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        fps: metadata.fps,
        hasAudio: metadata.has_audio,
        videoBitrate: metadata.video_bitrate,
        audioBitrate: metadata.audio_bitrate,
        mimeType: metadata.mime_type
      }
    } catch (error) {
      throw new TranscodeError('Failed to get video metadata', 'METADATA_ERROR', error as Error)
    }
  }

  /**
   * Транскодировать видео
   */
  async transcode(
    file: File,
    options: TranscodeOptions = {},
    onProgress?: (progress: TranscodeProgress) => void
  ): Promise<TranscodeResult> {
    if (!this.isSupported()) {
      throw new TranscodeError('Tauri is not available', 'NOT_SUPPORTED')
    }

    // Получаем метаданные
    const metadata = await this.getMetadata(file)

    // Определяем целевое разрешение
    const targetResolution = options.resolution || selectTargetResolution(metadata.width, metadata.height)
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

    // Вычисляем audioBitrate: если есть аудио, используем опции или значение по умолчанию
    const audioBitrate = metadata.hasAudio
      ? (options.audioBitrate || MAX_AUDIO_BITRATE)
      : 0

    try {
      // Сохраняем файл во временную директорию
      const inputFilePath = await this.saveFileToTemp(file)

      // Параметры для транскодирования (snake_case для Rust)
      const transcodeParams = {
        input_path: inputFilePath,
        output_path: '', // Будет создан автоматически
        width,
        height,
        video_bitrate: videoBitrate,
        audio_bitrate: audioBitrate,
        fps,
        has_audio: metadata.hasAudio // Если в исходном видео есть аудио, передаем true
      }

      // Настраиваем слушатель событий прогресса
      let progressUnlisten: (() => void) | null = null
      if (onProgress) {
        const unlisten = await listen<{ progress: number; currentTime: number; duration: number }>(
          'transcode-progress',
          (event) => {
            if (onProgress) {
              onProgress({
                progress: event.payload.progress,
                framesProcessed: undefined
              })
            }
          }
        )
        progressUnlisten = unlisten
      }

      try {
        // Вызываем Tauri команду для транскодирования
        // Tauri автоматически конвертирует camelCase в snake_case для Rust
        const result = await invoke<{
          output_path: string
          width: number
          height: number
          duration: number
          file_size: number
        }>('transcode_video', {
          inputPath: transcodeParams.input_path,
          outputPath: transcodeParams.output_path,
          width: transcodeParams.width,
          height: transcodeParams.height,
          videoBitrate: transcodeParams.video_bitrate,
          audioBitrate: transcodeParams.audio_bitrate,
          fps: transcodeParams.fps,
          hasAudio: transcodeParams.has_audio,
          duration: metadata.duration
        })

        // Читаем результат из файла
        const outputFile = await invoke<number[]>('read_file', {
          filePath: result.output_path
        })

        // Создаем Blob, используя Worker для больших файлов
        const blob = await this.createBlobInWorker(outputFile, 'video/webm')

        // Удаляем временные файлы
        await invoke('delete_temp_file', { filePath: inputFilePath })
        await invoke('delete_temp_file', { filePath: result.output_path })

        const transcodeResult: TranscodeResult = {
          blob,
          width: result.width,
          height: result.height,
          resolution: getResolutionString(targetResolution),
          videoBitrate,
          audioBitrate,
          fps,
          hasAudio: metadata.hasAudio && !!audioBitrate,
          mimeType: 'video/webm',
          duration: result.duration
        }

        return transcodeResult
      } catch (error) {
        throw new TranscodeError('Tauri transcoding error', 'TRANSCODE_ERROR', error as Error)
      } finally {
        // Отключаем слушатель событий
        if (progressUnlisten) {
          progressUnlisten()
        }
      }
    } catch (error) {
      throw new TranscodeError('Failed to transcode video', 'TRANSCODE_ERROR', error as Error)
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

      if (file.size > 5 * 1024 * 1024) { // > 5MB
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
        data
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
      const worker = new Worker(
        new URL('./file-worker.ts', import.meta.url),
        { type: 'module' }
      )

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
      worker.postMessage({
        type: 'READ_FILE',
        payload: { arrayBuffer }
      }, [arrayBuffer])
    })
  }

  /**
   * Создать Blob из данных в Web Worker
   * Для больших файлов (до 4GB) использует Worker, чтобы не блокировать UI
   */
  private async createBlobInWorker(data: number[], mimeType: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Для данных меньше 10MB создаем Blob напрямую (быстро)
      if (data.length < 10 * 1024 * 1024) { // < 10MB
        const blob = new Blob([new Uint8Array(data)], { type: mimeType })
        resolve(blob)
        return
      }

      // Для больших данных (до 4GB) используем Worker
      const worker = new Worker(
        new URL('./file-worker.ts', import.meta.url),
        { type: 'module' }
      )

      const timeout = setTimeout(() => {
        worker.terminate()
        reject(new Error('Blob creation timeout'))
      }, 300000) // 5 минут таймаут для очень больших файлов

      worker.onmessage = (event: MessageEvent) => {
        const { type, payload } = event.data

        if (type === 'BLOB_CREATED') {
          clearTimeout(timeout)
          worker.terminate()
          resolve(payload.blob)
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

      // Отправляем данные порциями для очень больших файлов
      // Но для простоты отправляем все сразу (Worker обработает)
      worker.postMessage({
        type: 'CREATE_BLOB',
        payload: { data, mimeType }
      })
    })
  }

  /**
   * Уничтожить транскодер и освободить ресурсы
   */
  destroy(): void {
    // Tauri транскодер не требует очистки
  }
}
