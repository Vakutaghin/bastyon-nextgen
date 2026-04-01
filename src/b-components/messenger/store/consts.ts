// Константы мессенджера

/** Размер батча при загрузке профилей пользователей */
export const PROFILE_BATCH_SIZE = 20

/** Задержка перед отправкой батча запросов на профили (мс) */
export const PROFILE_FETCH_DELAY = 100

/** Количество сообщений при пагинации истории */
export const MESSAGES_PER_PAGE = 30

/** Максимальное время ожидания инициализации шифрования (мс) */
export const PCRYPTO_WAIT_TIMEOUT = 5000

/** Сокращённый таймаут ожидания шифрования для диалогов (мс) */
export const PCRYPTO_DIALOG_TIMEOUT = 1500

/** Время кэширования высоты текущего блока (мс) */
export const BLOCK_HEIGHT_CACHE_TTL = 55_000

/** Максимальный возраст сообщения для воспроизведения звука (мс) */
export const SOUND_MAX_AGE = 60_000

/** Задержка обновления диалогов при обновлении профилей (мс) */
export const PROFILE_UPDATE_DEBOUNCE = 500

/** Дефолтный блок для шифрования в DM */
export const DEFAULT_ENCRYPTION_BLOCK = 10

/** Фиксированный IV для AES-CBC шифрования аудио (bastyon-chat совместимость) */
export const AES_CBC_IV = new Uint8Array([19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34])

/** Соль для PBKDF2 деривации ключа */
export const PBKDF2_SALT = 'matrix.pocketnet'

/** Количество итераций PBKDF2 */
export const PBKDF2_ITERATIONS = 10_000

/** Резервный Matrix-хост */
export const DEFAULT_MATRIX_HOST = 'matrix.pocketnet.app'

/** Текст-заглушка для нерасшифрованных сообщений */
export const ENCRYPTED_MESSAGE_PLACEHOLDER = '*** Encrypted Message ***'
