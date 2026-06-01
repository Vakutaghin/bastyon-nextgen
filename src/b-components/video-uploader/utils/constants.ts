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
 * Минимальный FPS
 */
export const MIN_FPS = 15

/**
 * Максимальный FPS
 */
export const MAX_FPS = 60

/**
 * Параметры кодирования по умолчанию
 */
export const DEFAULT_ENCODING_OPTIONS = {
  videoBitrate: MAX_VIDEO_BITRATE,
  audioBitrate: MAX_AUDIO_BITRATE,
  fps: TARGET_FPS,
  preserveAspectRatio: true,
} as const

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
 * Data-saver preset — для слабых сетей или старых устройств.
 * Совпадает со старым потолком (720p / 1.5 Mbps / 30fps), чтобы поведение прошлых
 * сборок было воспроизводимо через явный preset.
 */
export const DATA_SAVER_PRESET = {
  resolution: 720 as TargetResolution,
  videoBitrate: 1500,
  audioBitrate: 96,
  fps: 30,
} as const

/**
 * Потолок разрешения для браузерного (ffmpeg.wasm) пути. wasm в 5–10× медленнее
 * нативного, поэтому по умолчанию не поднимаемся выше 480p (см. Phase 4).
 */
export const WASM_MAX_RESOLUTION: TargetResolution = 480

/**
 * Мягкий потолок размера входного файла для браузерного транскода. Выше этого
 * ffmpeg.wasm рискует упереться в память вкладки — предлагаем десктоп-приложение.
 */
export const WASM_RECOMMENDED_MAX_SIZE = 200 * 1024 * 1024 // 200 MB

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
  WEBM_VP8_OPUS: 'video/webm;codecs=vp8,opus',
} as const

/**
 * Расширения файлов
 */
export const FILE_EXTENSIONS = {
  MP4: '.mp4',
  WEBM: '.webm',
} as const

/**
 * Лимиты размера файлов
 */
export const FILE_SIZE_LIMITS = {
  MAX_ORIGINAL_SIZE: 4 * 1024 * 1024 * 1024, // 4 GB
  MAX_TRANSCODED_SIZE: 2 * 1024 * 1024 * 1024, // 2 GB
} as const

/**
 * Таймауты (в миллисекундах)
 */
export const TIMEOUTS = {
  VIDEO_LOAD: 30000, // 30 секунд на загрузку метаданных видео
  TRANSCODING: 3600000, // 1 час на транскодирование (для очень больших файлов)
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
  MAX_AGE_DAYS: 30,
} as const
