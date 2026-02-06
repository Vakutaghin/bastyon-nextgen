/**
 * Константы для подписей
 */

/**
 * Версия протокола подписи по умолчанию
 */
export const DEFAULT_SIGNATURE_VERSION = 1

/**
 * Время жизни подписи по умолчанию (в секундах)
 */
export const DEFAULT_SIGNATURE_EXPIRATION = 360

/**
 * Смещение времени истечения подписи (в секундах)
 */
export const DEFAULT_SIGNATURE_EXPIRATION_SHIFT = 160

/**
 * Данные для подписи по умолчанию
 */
export const DEFAULT_SIGNATURE_DATA = 'pocketnetproxy'

/**
 * Минимальное время жизни подписи (в секундах)
 */
export const MIN_SIGNATURE_EXPIRATION = 60

/**
 * Максимальное время жизни подписи (в секундах)
 */
export const MAX_SIGNATURE_EXPIRATION = 86400 // 24 часа
