/**
 * Константы для транскодирования видео
 */

/**
 * Доступные разрешения для транскодирования (в пикселях по высоте)
 * Видео будет транскодировано в одно из этих разрешений в зависимости от оригинала
 */
export const TARGET_RESOLUTIONS = [144, 240, 360, 480, 720, 1080] as const

export type TargetResolution = (typeof TARGET_RESOLUTIONS)[number]

/**
 * Максимальное разрешение (1080p)
 */
export const MAX_RESOLUTION = 1080

/**
 * Минимальное разрешение (144p)
 */
export const MIN_RESOLUTION = 144

/**
 * Максимальный битрейт видео (kbps) — потолок для 1080p
 */
export const MAX_VIDEO_BITRATE = 4000 // kbps

/**
 * Максимальный битрейт аудио (kbps)
 */
export const MAX_AUDIO_BITRATE = 128 // kbps

/**
 * Целевой FPS по умолчанию
 * Если оригинал имеет больший FPS, будет ограничен до MAX_FPS
 */
export const TARGET_FPS = 30

/**
 * Максимальный FPS
 */
export const MAX_FPS = 60

/**
 * Соответствие разрешений и рекомендуемых битрейтов
 */
export const RESOLUTION_BITRATE_MAP: Record<TargetResolution, number> = {
  144: 200, // kbps
  240: 400,
  360: 600,
  480: 900,
  720: 1500,
  1080: 4000, // потолок MAX_VIDEO_BITRATE
}

/**
 * Получить рекомендуемый битрейт для разрешения
 */
export function getBitrateForResolution(resolution: TargetResolution): number {
  return Math.min(RESOLUTION_BITRATE_MAP[resolution] || MAX_VIDEO_BITRATE, MAX_VIDEO_BITRATE)
}

// 100ms

/**
 * Лимиты хранилища IndexedDB
 */
export const STORAGE_LIMITS = {
  /** Максимальный размер хранилища в мегабайтах */
  MAX_SIZE_MB: 500,
  /** Максимальное количество видео */
  MAX_COUNT: 50,
  /** Максимальный возраст записи в днях */
  MAX_AGE_DAYS: 30,
} as const
