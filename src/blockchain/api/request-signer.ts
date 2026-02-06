/**
 * Подпись запросов к API
 */

import type { ApiSignature } from '../types/signatures'
import type { KeyPair } from '../types/keys'
import type { Address } from '../types/addresses'
import { generateApiSignature } from '../core/signatures'

/**
 * Опции для подписи запроса
 */
export interface RequestSignOptions {
  /** Требуется ли подпись (по умолчанию true) */
  requireSignature?: boolean
  /** Сессия для подписи */
  session?: string
  /** Данные для подписи (по умолчанию 'pocketnetproxy') */
  data?: string
  /** Время жизни подписи в секундах */
  expiration?: number
}

/**
 * Подписывает данные запроса
 * @param data - Данные запроса
 * @param keyPair - Ключевая пара для подписи
 * @param address - Адрес пользователя
 * @param options - Опции подписи
 * @returns Данные с добавленной подписью
 */
export function signRequest<T extends Record<string, unknown>>(
  data: T,
  keyPair: KeyPair | null,
  address: Address | null,
  options: RequestSignOptions = {}
): T {
  const { requireSignature = true, session, data: signatureData, expiration } = options

  // Если подпись не требуется или нет ключевой пары
  if (!requireSignature || !keyPair || !address) {
    // Если пользователь авторизован, добавляем state = 1
    if (keyPair && address) {
      return {
        ...data,
        state: 1,
      } as T
    }
    return data
  }

  try {
    // Генерируем подпись
    const signature = generateApiSignature(
      keyPair,
      address,
      {
        data: signatureData || session || 'pocketnetproxy',
        session,
        expiration,
      }
    )

    // Добавляем подпись к данным
    return {
      ...data,
      signature,
    } as T
  } catch (error) {
    // В случае ошибки возвращаем данные без подписи
    console.error('Failed to sign request:', error)
    return {
      ...data,
      state: 1,
    } as T
  }
}

/**
 * Создает функцию для автоматической подписи запросов
 * @param getKeyPair - Функция для получения ключевой пары
 * @param getAddress - Функция для получения адреса
 * @returns Функция для подписи запросов
 */
export function createRequestSigner(
  getKeyPair: () => KeyPair | null,
  getAddress: () => Address | null
) {
  return <T extends Record<string, unknown>>(
    data: T,
    options: RequestSignOptions = {}
  ): T => {
    return signRequest(data, getKeyPair(), getAddress(), options)
  }
}
