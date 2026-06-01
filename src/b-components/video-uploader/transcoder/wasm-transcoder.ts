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
  WASM_MAX_RESOLUTION,
  WASM_RECOMMENDED_MAX_SIZE,
  getBitrateForResolution,
  type TargetResolution,
} from '../utils/constants'

// Адреса single-thread ядра ffmpeg.wasm. `?url` отдаёт same-origin путь (Vite копирует
// файлы в dist как ассеты) — никакого CDN, ничего не тянется в основной бандл (это лишь
// строки-ссылки; сам 31MB .wasm грузится по сети только при первом транскоде).
// Single-thread не использует SharedArrayBuffer → cross-origin isolation в проде не нужна,
// встроенные мини-аппы и postMessage не ломаются.
// Через экспорт-специфаеры пакета (deep-путь dist/esm/... закрыт `exports`-картой @ffmpeg/core).
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

// Минимальный тип FFmpeg-инстанса (импортируем сам класс лениво, чтобы ничего ffmpeg-related
// не попало в стартовый чанк).
interface FFmpegInstance {
  loaded: boolean
  load(config?: { coreURL?: string; wasmURL?: string }): Promise<boolean>
  writeFile(path: string, data: Uint8Array): Promise<boolean>
  readFile(path: string): Promise<Uint8Array | string>
  deleteFile(path: string): Promise<boolean>
  exec(args: string[]): Promise<number>
  on(event: 'progress', cb: (e: { progress: number; time: number }) => void): void
  off(event: 'progress', cb: (e: { progress: number; time: number }) => void): void
}

/**
 * Браузерный транскодер на ffmpeg.wasm (single-thread).
 * Запасной путь, когда нет Tauri — даёт standalone-работу без нативной обвязки
 * (см. принцип децентрализации). В 5–10× медленнее нативного ffmpeg, поэтому дефолты
 * консервативнее (480p) и есть мягкий потолок по размеру входного файла.
 */
export class WasmTranscoder implements Transcoder {
  readonly kind = 'wasm' as const

  private ffmpeg: FFmpegInstance | null = null
  private loadPromise: Promise<FFmpegInstance> | null = null
  /** Текущий progress-callback одного активного транскода (ffmpeg.wasm — один инстанс за раз). */
  private activeProgress: ((p: TranscodeProgress) => void) | null = null
  private transcoding = false

  /**
   * Поддерживается в браузере с WebAssembly + Worker + DOM. SharedArrayBuffer НЕ требуется
   * (single-thread ядро), поэтому crossOriginIsolated проверять не нужно.
   */
  isSupported(): boolean {
    return (
      typeof WebAssembly !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      typeof document !== 'undefined'
    )
  }

  /**
   * Лениво грузит ffmpeg.wasm-ядро (≈31MB). Инстанс переиспользуется между транскодами.
   * progress-событие регистрируется один раз и проксируется в текущий activeProgress.
   */
  private async ensureLoaded(): Promise<FFmpegInstance> {
    if (this.ffmpeg?.loaded) return this.ffmpeg
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { toBlobURL } = await import('@ffmpeg/util')
      const instance = new FFmpeg() as unknown as FFmpegInstance

      instance.on('progress', ({ progress }) => {
        if (!this.activeProgress) return
        // ffmpeg иногда отдаёт >1 в хвосте — клампим в [0, 100].
        const pct = Math.max(0, Math.min(100, Math.round(progress * 100)))
        this.activeProgress({ progress: pct })
      })

      // Грузим ядро через blob-URL (fetch same-origin ассета) — устойчиво к COEP.
      await instance.load({
        coreURL: await toBlobURL(coreURL, 'text/javascript'),
        wasmURL: await toBlobURL(wasmURL, 'application/wasm'),
      })
      this.ffmpeg = instance
      return instance
    })()

    try {
      return await this.loadPromise
    } catch (error) {
      this.loadPromise = null
      throw new TranscodeError(
        'Не удалось загрузить браузерный видеокодек (ffmpeg.wasm)',
        'WASM_LOAD_ERROR',
        error as Error
      )
    }
  }

  /**
   * Метаданные без транскода — через скрытый <video> (быстро, без запуска wasm).
   * fps из HTMLVideoElement недоступен → берём целевой по умолчанию; hasAudio — best-effort
   * (на транскоде аудио маппится опционально, так что промах не критичен).
   */
  async getMetadata(file: File): Promise<VideoMetadata> {
    if (!this.isSupported()) {
      throw new TranscodeError('WebAssembly is not available', 'NOT_SUPPORTED')
    }
    return new Promise<VideoMetadata>((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true

      const cleanup = () => {
        URL.revokeObjectURL(url)
        video.removeAttribute('src')
        video.load()
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(new TranscodeError('Timed out reading video metadata', 'METADATA_ERROR'))
      }, 30_000)

      video.onloadedmetadata = () => {
        clearTimeout(timer)
        const width = video.videoWidth
        const height = video.videoHeight
        const duration = Number.isFinite(video.duration) ? video.duration : 0

        // Аудио: используем нестандартные хинты, где они есть; иначе считаем, что аудио есть.
        const v = video as HTMLVideoElement & {
          mozHasAudio?: boolean
          audioTracks?: { length: number }
        }
        let hasAudio = true
        if (typeof v.mozHasAudio === 'boolean') hasAudio = v.mozHasAudio
        else if (v.audioTracks) hasAudio = v.audioTracks.length > 0

        cleanup()
        if (width <= 0 || height <= 0) {
          reject(new TranscodeError('Could not determine video dimensions', 'METADATA_ERROR'))
          return
        }
        resolve({ width, height, duration, fps: TARGET_FPS, hasAudio })
      }
      video.onerror = () => {
        clearTimeout(timer)
        cleanup()
        reject(new TranscodeError('Failed to read video metadata', 'METADATA_ERROR'))
      }
      video.src = url
    })
  }

  async transcode(
    file: File,
    options: TranscodeOptions = {},
    onProgress?: (progress: TranscodeProgress) => void
  ): Promise<TranscodeResult> {
    if (!this.isSupported()) {
      throw new TranscodeError('WebAssembly is not available', 'NOT_SUPPORTED')
    }
    if (this.transcoding) {
      throw new TranscodeError('Transcoding already in progress', 'TRANSCODE_ERROR')
    }
    if (file.size > WASM_RECOMMENDED_MAX_SIZE) {
      throw new TranscodeError(
        'Файл слишком большой для браузерного транскодинга — используйте десктоп-приложение',
        'FILE_TOO_LARGE'
      )
    }

    const metadata = await this.getMetadata(file)

    // Дефолт для wasm-пути — не выше 480p (wasm в 5–10× медленнее нативного).
    const autoResolution = Math.min(
      selectTargetResolution(metadata.width, metadata.height),
      WASM_MAX_RESOLUTION
    ) as TargetResolution
    const targetResolution = options.resolution ?? autoResolution
    const { width, height } = calculateTargetDimensions(
      metadata.width,
      metadata.height,
      targetResolution
    )

    const sourceBitrate = metadata.videoBitrate
      ? metadata.videoBitrate
      : metadata.duration > 0
        ? Math.round((file.size * 8) / (metadata.duration * 1000))
        : MAX_VIDEO_BITRATE
    const calculatedBitrate = options.videoBitrate || getBitrateForResolution(targetResolution)
    const videoBitrate = Math.min(
      calculatedBitrate,
      MAX_VIDEO_BITRATE,
      sourceBitrate > 0 ? sourceBitrate : Infinity
    )
    const fps = Math.min(options.fps || TARGET_FPS, MAX_FPS)
    const audioBitrate = options.audioBitrate || MAX_AUDIO_BITRATE
    // Браузерное ядро по умолчанию даёт h264/MP4 — нативно играет везде, включая iOS Safari.
    const codec: TranscodeCodec = options.codec ?? 'h264'

    const ffmpeg = await this.ensureLoaded()
    const { fetchFile } = await import('@ffmpeg/util')

    const inputName = `input.${this.safeExt(file.name)}`
    const isVp9 = codec === 'vp9'
    const outputName = isVp9 ? 'output.webm' : 'output.mp4'

    this.transcoding = true
    this.activeProgress = onProgress ?? null
    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file))

      const args = [
        '-i',
        inputName,
        '-vf',
        `scale=${width}:${height}`,
        '-r',
        String(fps),
        ...this.videoCodecArgs(codec, videoBitrate),
        '-pix_fmt',
        'yuv420p',
        // Аудио маппим опционально: если в источнике нет дорожки — ffmpeg просто её пропустит.
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        ...this.audioCodecArgs(codec, audioBitrate),
        ...(isVp9 ? [] : ['-movflags', '+faststart']),
        outputName,
      ]

      await ffmpeg.exec(args)

      const data = await ffmpeg.readFile(outputName)
      if (typeof data === 'string') {
        throw new TranscodeError('Unexpected string output from ffmpeg', 'TRANSCODE_ERROR')
      }
      const mimeType = isVp9 ? 'video/webm' : 'video/mp4'
      // Копируем в свежий ArrayBuffer: data — view на heap wasm, который переиспользуется.
      const blob = new Blob([data.slice()], { type: mimeType })

      return {
        blob,
        width,
        height,
        resolution: getResolutionString(targetResolution),
        videoBitrate,
        audioBitrate,
        fps,
        hasAudio: metadata.hasAudio,
        mimeType,
        duration: metadata.duration,
      }
    } catch (error) {
      if (error instanceof TranscodeError) throw error
      const err = error as Error
      throw new TranscodeError(err?.message || 'Failed to transcode video', 'TRANSCODE_ERROR', err)
    } finally {
      this.transcoding = false
      this.activeProgress = null
      // Чистим виртуальную ФС, иначе heap растёт от транскода к транскоду.
      await ffmpeg.deleteFile(inputName).catch(() => {})
      await ffmpeg.deleteFile(outputName).catch(() => {})
    }
  }

  private videoCodecArgs(codec: TranscodeCodec, videoBitrate: number): string[] {
    const maxrate = Math.round(videoBitrate * 1.45)
    const bufsize = videoBitrate * 2
    if (codec === 'vp9') {
      return [
        '-c:v',
        'libvpx-vp9',
        '-b:v',
        `${videoBitrate}k`,
        '-deadline',
        'realtime',
        '-cpu-used',
        '5',
      ]
    }
    return [
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-b:v',
      `${videoBitrate}k`,
      '-maxrate',
      `${maxrate}k`,
      '-bufsize',
      `${bufsize}k`,
    ]
  }

  private audioCodecArgs(codec: TranscodeCodec, audioBitrate: number): string[] {
    if (codec === 'vp9') {
      return ['-c:a', 'libopus', '-b:a', `${audioBitrate}k`]
    }
    return ['-c:a', 'aac', '-b:a', `${audioBitrate}k`]
  }

  /** Безопасное имя для виртуальной ФС ffmpeg — оставляем только расширение из исходного. */
  private safeExt(fileName: string): string {
    const dot = fileName.lastIndexOf('.')
    const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : 'mp4'
    return /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'mp4'
  }

  destroy(): void {
    this.ffmpeg = null
    this.loadPromise = null
    this.activeProgress = null
    this.transcoding = false
  }
}
