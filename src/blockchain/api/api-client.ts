/**
 * Расширенный API клиент с поддержкой авторизации
 */

import type { T_RpcRequestParams as RpcRequestParams, RpcOptions } from '../../helpers/api/request'
import { signRequest } from './request-signer'
import type { KeyPair } from '../types/keys'
import type { Address } from '../types/addresses'

/**
 * Опции для API запроса с авторизацией
 */
export interface AuthenticatedRpcOptions extends RpcOptions {
  /** Требуется ли подпись запроса */
  auth?: boolean
  /** Сессия для подписи */
  session?: string
}

/**
 * Расширенные параметры RPC запроса с авторизацией
 */
export interface AuthenticatedRpcRequestParams extends Omit<RpcRequestParams, 'options'> {
  options?: AuthenticatedRpcOptions
}

/**
 * Конфигурация API клиента
 */
export interface ApiClientConfig {
  /** Функция для получения ключевой пары */
  getKeyPair: () => KeyPair | null
  /** Функция для получения адреса */
  getAddress: () => Address | null
  /** Базовый URL сервера */
  baseUrl?: string
  /** Таймаут запросов в миллисекундах */
  timeout?: number
}

/**
 * Создает расширенный API клиент с поддержкой авторизации
 * @param config - Конфигурация клиента
 * @returns Функция для выполнения запросов
 */
export function createAuthenticatedApiClient(config: ApiClientConfig) {
  const { getKeyPair, getAddress, timeout = 30000 } = config

  return async function authenticatedRpcRequest(
    params: AuthenticatedRpcRequestParams,
    customConfig?: { host?: string; port?: number }
  ): Promise<unknown> {
    // Импортируем getByPRC динамически, чтобы избежать циклических зависимостей
    const { getByPRC } = await import('../../helpers/api/request')

    // Подготавливаем параметры запроса
    let requestParams: RpcRequestParams = {
      method: params.method,
      parameters: params.parameters,
      cachehash: params.cachehash,
      options: params.options,
    }

    // Если требуется авторизация, подписываем запрос
    const keyPair = getKeyPair()
    const address = getAddress()

    if (params.options?.auth !== false) {
      if (keyPair && address) {
        requestParams = signRequest(
          requestParams,
          keyPair,
          address,
          {
            requireSignature: true,
            session: params.options?.session,
          }
        ) as RpcRequestParams
      }
    } else if (keyPair && address) {
      // Авторизован, но подпись не требуется — добавляем state
      requestParams.state = 1
    }

    // Выполняем запрос
    return getByPRC(requestParams, customConfig)
  }
}
