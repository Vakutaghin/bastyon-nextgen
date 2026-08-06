import type {
  Transcoder,
  TranscodeOptions,
  TranscodeProgress,
  TranscodeResult,
  VideoMetadata,
} from './types'
import { TauriTranscoder } from './tauri-transcoder'
import { TranscodeError, type TranscoderKind } from './types'

/**
 * Главный транскодер.
 * Выбирает реализацию по приоритету: Tauri (нативный ffmpeg) → ffmpeg.wasm (браузер) → нет.
 * wasm-путь даёт standalone-работу без нативной обвязки (принцип децентрализации).
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

  /**
   * Выбрать транскодер по приоритету Tauri → ffmpeg.wasm → null.
   * wasm-модуль грузится лениво (динамический import), чтобы ничего ffmpeg-related
   * не попадало в стартовый чанк до реальной надобности.
   */
  private async selectTranscoder(): Promise<void> {
    // 1) Tauri — самый быстрый, нативный ffmpeg.
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
      // Игнорируем — пробуем браузерный путь.
    }

    // 2) Браузер — ffmpeg.wasm (standalone, без нативной обвязки).
    try {
      const { WasmTranscoder } = await import('./wasm-transcoder')
      const wasm = new WasmTranscoder()
      if (wasm.isSupported()) {
        this.transcoder = wasm
        return
      }
    } catch {
      // Игнорируем ошибки инициализации wasm.
    }

    // 3) Ничего не доступно.
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
      throw new TranscodeError(
        'Транскодирование видео доступно только в Tauri приложении. В браузере эта функция не поддерживается.',
        'NOT_SUPPORTED'
      )
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
      throw new TranscodeError(
        'Транскодирование видео доступно только в Tauri приложении. В браузере эта функция не поддерживается.',
        'NOT_SUPPORTED'
      )
    }

    if (!this.transcoder.isSupported()) {
      throw new TranscodeError(
        'Транскодирование видео не поддерживается в этом окружении',
        'NOT_SUPPORTED'
      )
    }

    return await this.transcoder.transcode(file, options, onProgress)
  }

  /**
   * Проверить, доступен ли системный ffmpeg в Tauri.
   * Браузер всегда возвращает { ffmpeg: false } — там и должен сработать другой fallback (Phase 4).
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
   * `method`: 'tauri' (нативный) | 'wasm' (браузер) | 'none' (не поддерживается).
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

// Экспортируем функции для прямого использования
export async function transcodeVideo(
  file: File,
  options?: TranscodeOptions,
  onProgress?: (progress: TranscodeProgress) => void
): Promise<TranscodeResult> {
  return transcoder.transcode(file, options, onProgress)
}

export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return transcoder.getMetadata(file)
}

export function isTranscodingSupported(): boolean {
  return transcoder.isSupported()
}
