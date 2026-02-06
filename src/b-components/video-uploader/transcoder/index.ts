import type {
  Transcoder,
  TranscodeOptions,
  TranscodeProgress,
  TranscodeResult,
  VideoMetadata
} from './types'
import { TauriTranscoder } from './tauri-transcoder'
import { TranscodeError } from './types'
import { isTauri } from '../utils/environment'

/**
 * Главный транскодер
 * Использует только TauriTranscoder (работает только в Tauri)
 */
class UniversalTranscoder implements Transcoder {
  private transcoder: Transcoder | null = null
  private initPromise: Promise<void> | null = null

  constructor() {
    // Инициализируем асинхронно
    this.initPromise = this.selectTranscoder().catch(() => {
      // Игнорируем ошибки инициализации
    })
  }
  
  /**
   * Дождаться завершения инициализации
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise
    }
  }

  /**
   * Выбрать транскодер
   * Используется только TauriTranscoder
   */
  private async selectTranscoder(): Promise<void> {
    // Используем только TauriTranscoder
    try {
      const tauriTranscoder = new TauriTranscoder()
      
      // Сначала проверяем синхронно
      if (tauriTranscoder.isSupported()) {
        this.transcoder = tauriTranscoder
        return
      }
      
      // Если синхронная проверка не сработала, пробуем асинхронную
      const { isTauriAsync } = await import('../utils/environment')
      if (await isTauriAsync()) {
        this.transcoder = tauriTranscoder
        return
      }
    } catch {
      // Игнорируем ошибки инициализации
    }

    // Если Tauri не доступен
    this.transcoder = null
  }

  /**
   * Проверить поддержку (синхронная версия)
   * Для более надежной проверки используйте isSupportedAsync()
   */
  isSupported(): boolean {
    // Транскодирование поддерживается только в Tauri
    return isTauri() && this.transcoder !== null && (this.transcoder?.isSupported() ?? false)
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
   * Получить информацию о текущем транскодере
   */
  getTranscoderInfo(): { method: string; supported: boolean } {
    if (this.transcoder instanceof TauriTranscoder) {
      return {
        method: 'tauri',
        supported: this.isSupported()
      }
    }
    return {
      method: 'none',
      supported: false
    }
  }

  /**
   * Уничтожить транскодер и освободить ресурсы
   */
  destroy(): void {
    if (this.transcoder instanceof TauriTranscoder) {
      this.transcoder.destroy()
    }
    this.transcoder = null
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
  VideoMetadata
} from './types'

export { TranscodeError } from './types'
export { TauriTranscoder } from './tauri-transcoder'
export { selectTargetResolution, calculateTargetDimensions, getResolutionString } from './resolution-selector'

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
