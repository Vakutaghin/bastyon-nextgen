import type {
  Transcoder,
  TranscodeOptions,
  TranscodeProgress,
  TranscodeResult,
  VideoMetadata,
} from './types'
import { TauriTranscoder } from './tauri-transcoder'
import { TranscodeError, type TranscoderKind } from './types'
import { t } from '@/i18n'

/**
 * Главный транскодер: нативный ffmpeg через Tauri, иначе — нет.
 *
 * Путь через ffmpeg.wasm убран (N17): загрузчик видео есть только в десктопе,
 * а там всегда выбирается нативный ffmpeg — wasm был недостижим, но его ядро
 * (31 МБ) лежало в каждой сборке, в том числе внутри бинарника десктопа и APK.
 * Для будущей загрузки на PeerTube из веба транскод тоже не нужен: старый
 * клиент в вебе отдаёт исходный файл, перекодирует сам PeerTube.
 */
class UniversalTranscoder implements Transcoder {
  readonly kind = 'tauri' as const // номинальное соответствие интерфейсу; реальный вид — getTranscoderInfo()
  private transcoder: Transcoder | null = null
  private initPromise: Promise<void> | null = null

  constructor() {
    // Инициализируем асинхронно
    this.initPromise = this.selectTranscoder().catch(() => {
      // Игнорируем ошибки инициализации
    })
  }

  /**
   * Дождаться завершения инициализации. Если memo сброшен (после destroy()),
   * заново выбираем транскодер — иначе singleton «кирпичится» до перезагрузки.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.selectTranscoder().catch(() => {
        // Игнорируем ошибки инициализации — getMetadata/transcode бросят NOT_SUPPORTED.
      })
    }
    await this.initPromise
  }

  /** Выбрать транскодер: нативный через Tauri или никакого. */
  private async selectTranscoder(): Promise<void> {
    try {
      const tauriTranscoder = new TauriTranscoder()
      if (tauriTranscoder.isSupported()) {
        this.transcoder = tauriTranscoder
        return
      }
      const { isTauriAsync } = await import('../utils/environment')
      if (await isTauriAsync()) {
        this.transcoder = tauriTranscoder
        return
      }
    } catch {
      // Вне Tauri — транскодера нет.
    }

    this.transcoder = null
  }

  /**
   * Проверить поддержку (синхронная версия).
   * До завершения async-инициализации может вернуть false — для надёжности используйте
   * isSupportedAsync().
   */
  isSupported(): boolean {
    return this.transcoder !== null && this.transcoder.isSupported()
  }

  /**
   * Асинхронная проверка поддержки (более надежная)
   */
  async isSupportedAsync(): Promise<boolean> {
    await this.ensureInitialized()
    return this.transcoder !== null && (this.transcoder?.isSupported() ?? false)
  }

  /**
   * Получить метаданные видео
   */
  async getMetadata(file: File): Promise<VideoMetadata> {
    // Ждем завершения инициализации
    await this.ensureInitialized()

    if (!this.transcoder) {
      throw new TranscodeError(t('videoMsg.transcodeNotSupported'), 'NOT_SUPPORTED')
    }

    return this.transcoder.getMetadata(file)
  }

  /**
   * Транскодировать видео
   */
  async transcode(
    file: File,
    options?: TranscodeOptions,
    onProgress?: (progress: TranscodeProgress) => void
  ): Promise<TranscodeResult> {
    // Ждем завершения инициализации
    await this.ensureInitialized()

    if (!this.transcoder) {
      throw new TranscodeError(t('videoMsg.transcodeNotSupported'), 'NOT_SUPPORTED')
    }

    if (!this.transcoder.isSupported()) {
      throw new TranscodeError(t('videoMsg.transcodeNotSupported'), 'NOT_SUPPORTED')
    }

    return await this.transcoder.transcode(file, options, onProgress)
  }

  /**
   * Проверить, доступен ли системный ffmpeg в Tauri.
   * Вне Tauri всегда `{ ffmpeg: false }`.
   */
  async checkFfmpegAvailable(): Promise<{
    ffmpeg: boolean
    ffprobe: boolean
    ffmpegVersion: string | null
  }> {
    await this.ensureInitialized()
    if (this.transcoder instanceof TauriTranscoder) {
      return this.transcoder.checkFfmpegAvailable()
    }
    return { ffmpeg: false, ffprobe: false, ffmpegVersion: null }
  }

  /**
   * Получить информацию о текущем транскодере.
   * `method`: 'tauri' (нативный ffmpeg) | 'none' (не поддерживается).
   */
  getTranscoderInfo(): { method: TranscoderKind | 'none'; supported: boolean } {
    return {
      method: this.transcoder?.kind ?? 'none',
      supported: this.isSupported(),
    }
  }

  /**
   * Дождаться инициализации и вернуть актуальный метод транскодера.
   */
  async getTranscoderInfoAsync(): Promise<{ method: TranscoderKind | 'none'; supported: boolean }> {
    await this.ensureInitialized()
    return this.getTranscoderInfo()
  }

  /**
   * Уничтожить транскодер и освободить ресурсы
   */
  destroy(): void {
    this.transcoder?.destroy?.()
    this.transcoder = null
    // Сбрасываем memo, чтобы следующий getMetadata/transcode заново выбрал
    // транскодер. Без этого initPromise остаётся resolved, ensureInitialized
    // не переинициализируется, и singleton навсегда остаётся с transcoder=null.
    this.initPromise = null
  }
}

// Экспортируем singleton экземпляр
export const transcoder = new UniversalTranscoder()

// Экспортируем типы и классы
export type {
  Transcoder,
  TranscodeOptions,
  TranscodeProgress,
  TranscodeResult,
  VideoMetadata,
} from './types'

export { TranscodeError } from './types'
export { TauriTranscoder } from './tauri-transcoder'
export {
  selectTargetResolution,
  calculateTargetDimensions,
  getResolutionString,
} from './resolution-selector'
