import type { TargetResolution } from '../utils/constants'

/**
 * Параметры транскодирования
 */
export interface TranscodeOptions {
  /** Целевое разрешение по высоте (144, 240, 360, 480, 720) */
  resolution?: TargetResolution
  /** Битрейт видео в kbps (максимум 1500) */
  videoBitrate?: number
  /** Битрейт аудио в kbps (максимум 128) */
  audioBitrate?: number
  /** FPS (максимум 30) */
  fps?: number
  /** Сохранять пропорции */
  preserveAspectRatio?: boolean
  /** MIME-тип для выходного файла */
  mimeType?: string
}

/**
 * Прогресс транскодирования
 */
export interface TranscodeProgress {
  /** Прогресс в процентах (0-100) */
  progress: number
  /** Обработано кадров */
  framesProcessed?: number
  /** Всего кадров (если известно) */
  totalFrames?: number
  /** Обработано времени в секундах */
  timeProcessed?: number
  /** Общая длительность в секундах */
  duration?: number
  /** Скорость обработки (кадров в секунду) */
  fps?: number
}

/**
 * Метаданные исходного видео
 */
export interface VideoMetadata {
  /** Ширина в пикселях */
  width: number
  /** Высота в пикселях */
  height: number
  /** Длительность в секундах */
  duration: number
  /** FPS */
  fps: number
  /** Есть ли аудио */
  hasAudio: boolean
  /** Битрейт видео в kbps (если доступен) */
  videoBitrate?: number
  /** Битрейт аудио в kbps (если доступен) */
  audioBitrate?: number
  /** MIME-тип исходного файла */
  mimeType?: string
}

/**
 * Результат транскодирования
 */
export interface TranscodeResult {
  /** Транскодированное видео как Blob */
  blob: Blob
  /** Ширина результата */
  width: number
  /** Высота результата */
  height: number
  /** Разрешение (144p, 240p, и т.д.) */
  resolution: string
  /** Использованный битрейт видео */
  videoBitrate: number
  /** Использованный битрейт аудио (если есть) */
  audioBitrate?: number
  /** FPS */
  fps: number
  /** Есть ли аудио */
  hasAudio: boolean
  /** MIME-тип результата */
  mimeType: string
  /** Длительность в секундах */
  duration: number
}

/**
 * Интерфейс транскодера
 */
export interface Transcoder {
  /**
   * Транскодировать видео
   * @param file Исходный видеофайл
   * @param options Параметры транскодирования
   * @param onProgress Callback для обновления прогресса
   * @returns Promise с результатом транскодирования
   */
  transcode(
    file: File,
    options?: TranscodeOptions,
    onProgress?: (progress: TranscodeProgress) => void
  ): Promise<TranscodeResult>

  /**
   * Получить метаданные видео без транскодирования
   * @param file Видеофайл
   * @returns Promise с метаданными
   */
  getMetadata(file: File): Promise<VideoMetadata>

  /**
   * Проверить, поддерживается ли транскодирование в текущем окружении
   * @returns true если поддерживается
   */
  isSupported(): boolean
}

/**
 * Ошибки транскодирования
 */
export class TranscodeError extends Error {
  constructor(
    message: string,
    public code?: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'TranscodeError'
  }
}
