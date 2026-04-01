// Константы компонента message-item

/** Набор быстрых реакций-эмодзи */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

/** Таймаут загрузки аудио (мс) */
export const AUDIO_LOAD_TIMEOUT = 30_000

/** Константа ошибки: источник не поддерживается */
export const MEDIA_ERR_SRC_NOT_SUPPORTED = 4

/** Алгоритм шифрования аудио */
export const AUDIO_ENCRYPTION_ALGORITHM = 'AES-CTR'

/** Длина счётчика AES-CTR (биты) */
export const AES_CTR_LENGTH = 64

/** Дефолтный MIME-тип аудио */
export const DEFAULT_AUDIO_MIME = 'audio/mpeg'

/** Регулярное выражение для извлечения URL из текста сообщения */
export const MESSAGE_URL_PATTERN = /((?:https?|ftp|bastyon):\/\/[^\s]+)/g
