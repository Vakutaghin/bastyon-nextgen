/**
 * Типы для работы с хранилищем ключей
 */

/**
 * Зашифрованные данные
 */
export type EncryptedData = string

/**
 * Опции для хранения
 */
export interface StorageOptions {
  /** Сохранять постоянно (localStorage) или только для сессии (sessionStorage) */
  persistent?: boolean
  /** Ключ для шифрования (обычно device fingerprint) */
  encryptionKey?: string
  /** Имя ключа в хранилище */
  storageKey?: string
}

/**
 * Результат сохранения
 */
export interface StorageSaveResult {
  /** Успешно сохранено */
  success: boolean
  /** Сообщение об ошибке (если не удалось) */
  error?: string
  /** Использованный тип хранилища */
  storageType?: 'localStorage' | 'sessionStorage'
}

/**
 * Результат загрузки
 */
export interface StorageLoadResult<T = string> {
  /** Данные (расшифрованные) */
  data: T | null
  /** Успешно загружено */
  success: boolean
  /** Сообщение об ошибке (если не удалось) */
  error?: string
  /** Использованный тип хранилища */
  storageType?: 'localStorage' | 'sessionStorage'
}

/**
 * Device fingerprint
 */
export type DeviceFingerprint = string

/**
 * Опции для шифрования
 */
export interface EncryptionOptions {
  /** Алгоритм шифрования */
  algorithm?: 'AES'
  /** Режим шифрования */
  mode?: 'CBC' | 'GCM'
}

/**
 * Опции для дешифрования
 */
export interface DecryptionOptions {
  /** Алгоритм шифрования */
  algorithm?: 'AES'
  /** Режим шифрования */
  mode?: 'CBC' | 'GCM'
}
