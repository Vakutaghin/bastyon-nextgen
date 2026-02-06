/**
 * Типы для работы с подписями
 */

/**
 * Версия протокола подписи
 */
export type SignatureVersion = 1

/**
 * Подпись для API запросов
 */
export interface ApiSignature {
  /** Nonce с временной меткой и данными */
  nonce: string
  /** ECDSA подпись в hex формате */
  signature: string
  /** Публичный ключ в hex формате */
  pubkey: string
  /** Pocketnet адрес */
  address: string
  /** Версия протокола */
  v: SignatureVersion
}

/**
 * Подпись для транзакций
 */
export interface TransactionSignature {
  /** Подпись в hex формате */
  signature: string
  /** Публичный ключ в hex формате */
  pubkey: string
  /** Адрес подписавшего */
  address: string
}

/**
 * Опции для генерации подписи API
 */
export interface ApiSignatureOptions {
  /** Данные для подписи (строка) */
  data?: string
  /** Время жизни подписи в секундах (по умолчанию 360) */
  expiration?: number
  /** Смещение времени истечения (по умолчанию 160) */
  expirationShift?: number
  /** Использовать старый формат подписи */
  useOldFormat?: boolean
  /** Сессия для подписи */
  session?: string
}

/**
 * Опции для генерации подписи транзакции
 */
export interface TransactionSignatureOptions {
  /** Индекс входа для подписи */
  inputIndex: number
  /** Скрипт предыдущего выхода */
  prevOutScript?: Buffer
  /** Тип скрипта предыдущего выхода */
  prevOutScriptType?: 'htlc' | 'p2pkh' | 'p2wpkh' | 'p2sh'
}

/**
 * Результат валидации подписи
 */
export interface SignatureValidationResult {
  /** Валидность подписи */
  isValid: boolean
  /** Сообщение об ошибке (если невалидна) */
  error?: string
  /** Время истечения подписи (для API подписей) */
  expirationTime?: Date
  /** Подпись истекла */
  isExpired?: boolean
}
