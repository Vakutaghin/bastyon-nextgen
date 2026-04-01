// Регулярные выражения для валидации данных

/** Валидация hex-строк произвольной длины */
export const HEX_REGEX = /^[0-9a-fA-F]+$/

/** Валидация hex-хэшей длиной 64 символа (SHA-256, txid) */
export const HEX_64_REGEX = /^[0-9a-f]{64}$/i

/** Извлечение URL из текста (http, https, ftp, bastyon протоколы) */
export const URL_REGEX = /(?:https?|ftp|bastyon):\/\/[^\s]+/g

/** Извлечение URL, включая www. без протокола */
export const URL_WITH_WWW_REGEX = /((https?:\/\/)|(www\.))[^\s]+/g

/** Определение URL-encoded текста (наличие %XX последовательностей) */
export const URL_ENCODED_REGEX = /%[0-9A-Fa-f]{2}/

/** Валидация кода капчи */
export const CAPTCHA_CODE_REGEX = /^[a-zA-Z0-9]{4,}$/

/** Нормализация пробелов — замена множественных пробелов на один */
export const WHITESPACE_NORMALIZE_REGEX = /\s+/g

/** Извлечение Unicode-букв, цифр и подчёркиваний (для тегов и категорий) */
export const TAG_SANITIZE_REGEX = /[^\p{L}\p{N}_]/gu
