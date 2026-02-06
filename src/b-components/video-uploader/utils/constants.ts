/**
 * Константы для транскодирования видео
 */

/**
 * Доступные разрешения для транскодирования (в пикселях по высоте)
 * Видео будет транскодировано в одно из этих разрешений в зависимости от оригинала
 */
export const TARGET_RESOLUTIONS = [144, 240, 360, 480, 720] as const

export type TargetResolution = typeof TARGET_RESOLUTIONS[number]

/**
 * Максимальное разрешение (720p)
 */
export const MAX_RESOLUTION = 720

/**
 * Минимальное разрешение (144p)
 */
export const MIN_RESOLUTION = 144

/**
 * Максимальный битрейт видео (kbps)
 */
export const MAX_VIDEO_BITRATE = 1500 // kbps

/**
 * Максимальный битрейт аудио (kbps)
 */
export const MAX_AUDIO_BITRATE = 128 // kbps

/**
 * Целевой и максимальный FPS для транскодирования
 * Если оригинал имеет больший FPS, будет ограничен до этого значения
 */
export const TARGET_FPS = 30

/**
 * Минимальный FPS
 */
export const MIN_FPS = 15

/**
 * Максимальный FPS (равен целевому)
 */
export const MAX_FPS = 30

/**
 * Параметры кодирования по умолчанию
 */
export const DEFAULT_ENCODING_OPTIONS = {
  videoBitrate: MAX_VIDEO_BITRATE,
  audioBitrate: MAX_AUDIO_BITRATE,
  fps: TARGET_FPS,
  preserveAspectRatio: true
} as const

/**
 * Соответствие разрешений и рекомендуемых битрейтов
 */
export const RESOLUTION_BITRATE_MAP: Record<TargetResolution, number> = {
  144: 200, // kbps для 144p
  240: 400, // kbps для 240p
  360: 600, // kbps для 360p
  480: 900, // kbps для 480p
  720: 1500 // kbps для 720p (максимум)
}

/**
 * Получить рекомендуемый битрейт для разрешения
 */
export function getBitrateForResolution(resolution: TargetResolution): number {
  return Math.min(RESOLUTION_BITRATE_MAP[resolution] || MAX_VIDEO_BITRATE, MAX_VIDEO_BITRATE)
}

/**
 * MIME-типы для различных форматов
 */
export const MIME_TYPES = {
  MP4: 'video/mp4',
  WEBM: 'video/webm',
  MP4_H264: 'video/mp4;codecs=h264',
  MP4_H264_AAC: 'video/mp4;codecs=h264,aac',
  WEBM_VP9: 'video/webm;codecs=vp9',
  WEBM_VP9_OPUS: 'video/webm;codecs=vp9,opus',
  WEBM_VP8: 'video/webm;codecs=vp8',
  WEBM_VP8_OPUS: 'video/webm;codecs=vp8,opus'
} as const

/**
 * Расширения файлов
 */
export const FILE_EXTENSIONS = {
  MP4: '.mp4',
  WEBM: '.webm'
} as const

/**
 * Лимиты размера файлов
 */
export const FILE_SIZE_LIMITS = {
  MAX_ORIGINAL_SIZE: 4 * 1024 * 1024 * 1024, // 4 GB
  MAX_TRANSCODED_SIZE: 2 * 1024 * 1024 * 1024 // 2 GB
} as const

/**
 * Таймауты (в миллисекундах)
 */
export const TIMEOUTS = {
  VIDEO_LOAD: 30000, // 30 секунд на загрузку метаданных видео
  TRANSCODING: 3600000 // 1 час на транскодирование (для очень больших файлов)
} as const

/**
 * Интервал обновления прогресса (в миллисекундах)
 */
export const PROGRESS_UPDATE_INTERVAL = 100 // 100ms

/**
 * Лимиты хранилища IndexedDB
 */
export const STORAGE_LIMITS = {
  /** Максимальный размер хранилища в мегабайтах */
  MAX_SIZE_MB: 500,
  /** Максимальное количество видео */
  MAX_COUNT: 50,
  /** Максимальный возраст записи в днях */
  MAX_AGE_DAYS: 30
} as const
