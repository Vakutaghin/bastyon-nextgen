// Константы компонента chat-room

/** Предпочтительные аудио-кодеки (в порядке приоритета) */
export const PREFERRED_AUDIO_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/aac',
] as const

/** Пороги свайпов (пиксели) */
export const TOUCH_THRESHOLDS = {
  /** Свайп вверх для фиксации записи */
  LOCK_UP: -50,
  /** Свайп влево для отмены записи */
  CANCEL_LEFT: -50,
} as const

/** Интервал обновления таймера записи (мс) */
export const RECORDING_TIMER_INTERVAL = 100

/** Отступ для автовысоты textarea (px) */
export const TEXTAREA_HEIGHT_PADDING = 2

/** Смещения для конвертации hex → Pocketnet-адрес */
export const HEX_CONSTANTS = {
  OFFSET_80: 0x80,
  OFFSET_350: 0x350,
} as const
