/**
 * RPC + HTTP запросы к Pocketnet прокси-серверам. Тонкая оркестрация:
 * формирование URL/body/error mapping; ретраи и Tor-fetch — в вынесенных модулях.
 *
 * Структура (по аудиту):
 * - `types/request.ts` — все типы (RpcOptions, T_RpcRequestParams, HttpRequestOptions, ...)
 * - `fetch-strategies.ts` — appFetch/matrixFetch/getTauriFetch routing
 * - `request-tor.ts` — Tauri-детект, tor_fetch invoke
 * - `request-debug.ts` — `window.__torDebug` инфраструктура
 * - `request-signing.ts` — подпись RPC/HTTP параметров через auth-store
 * - `rpc-errors.ts` — `isLogicError` / `isTimeout500`
 * - `rpc-retry.ts` — `retryWithBackoff` цикл по серверам
 */

import servers from '@/servers.json'
import { getRpcPath } from './rpc-endpoints'
import { appFetch } from './fetch-strategies'
import { retryWithBackoff, type ServerEndpoint } from './rpc-retry'
import { signRpcParamsIfNeeded, signHttpDataIfNeeded } from './request-signing'
import type { T_RpcRequestParams, RpcRequestConfig, HttpRequestParams } from './types/request'

// Re-exports — внешние модули продолжают импортировать всё из @/helpers/api/request.
export type {
  RpcOptions,
  T_RpcRequestParams,
  RpcRequestConfig,
  HttpRequestOptions,
  HttpRequestParams,
  TorFetchRequest,
  TorFetchResponse,
} from './types/request'
export { appFetch, matrixFetch, getTauriFetch } from './fetch-strategies'

/**
 * Выполняет RPC запрос к одному конкретному серверу.
 */
async function tryRpcRequest(
  params: T_RpcRequestParams,
  host: string,
  port: number
): Promise<unknown> {
  const useEx = params.options?.ex === true
  const path = getRpcPath(params.method, useEx)
  const url = `https://${host}:${port}${path}`

  const response = await appFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: JSON.stringify(params),
  })

  // Для некоторых методов (например, user.get) 500 может означать "не найдено"
  // Пытаемся прочитать тело ответа, даже если статус не OK
  let responseData: unknown
  try {
    responseData = await response.json()
  } catch {
    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`)
    }
    throw new Error('RPC request failed: Invalid JSON response')
  }

  // Если статус не OK, проверяем, является ли это ожидаемой ошибкой
  if (!response.ok) {
    // Для user.get 500 может означать "аккаунт не найден" (незарегистрирован)
    // Это нормальная ситуация, не ошибка
    if (params.method === 'user.get' && response.status === 500) {
      return { data: null }
    }

    const errorObj = responseData as { error?: unknown; message?: unknown } | null

    // Если ответ содержит JSON с ошибкой, выбрасываем его как объект
    if (responseData && typeof responseData === 'object' && 'error' in responseData) {
      throw errorObj?.error || responseData
    }

    const errorMessage =
      errorObj?.error ||
      errorObj?.message ||
      `RPC request failed: ${response.status} ${response.statusText}`
    throw new Error(String(errorMessage))
  }

  // Если статус OK, но есть error в ответе (нестандартное поведение некоторых методов)
  if (
    responseData &&
    typeof responseData === 'object' &&
    'error' in responseData &&
    (responseData as { error?: unknown }).error
  ) {
    throw (responseData as { error?: unknown }).error
  }

  return responseData
}

/**
 * Выполняет HTTP запрос к одному конкретному серверу.
 * Подписывает data (если требуется) и обрабатывает 401 как auth-ошибку.
 */
async function tryHttpRequest(
  params: HttpRequestParams,
  host: string,
  port: number
): Promise<unknown> {
  const { path, data, options } = params

  const signedData = await signHttpDataIfNeeded(data, options, path)

  const url = `https://${host}:${port}/${path}`

  const controller = new AbortController()
  const timeout = options?.timeout || 30000
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await appFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify(signedData),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`

      if (response.status === 401) {
        console.warn('[request] Auth failed for', path)
        throw new Error(`Authentication failed: ${errorMessage}`)
      }

      throw new Error(errorMessage)
    }

    const result = await response.json()

    // Проверяем наличие ошибки в ответе
    if (result.error) {
      if (result.error === 'Unauthorized' || result.error.includes('401')) {
        console.error('Authentication error in response', { path, error: result.error })
        throw new Error(`Authentication failed: ${result.error}`)
      }
      throw new Error(result.error)
    }

    return result.data || result
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout', { cause: error })
    }

    throw error
  }
}

/**
 * Выполняет HTTP запрос к Pocketnet серверу с автоматическим переключением между серверами.
 * Использует механизм backoff для оптимизации запросов.
 */
export async function fetchHttp(params: HttpRequestParams): Promise<unknown> {
  // Если указан конкретный host:port — обращаемся только к нему (для прокси с кошельком и т. п.)
  if (params.options?.host && params.options?.port) {
    return tryHttpRequest(params, params.options.host, params.options.port)
  }

  return retryWithBackoff(params, {
    servers: servers.servers.production.proxy as ServerEndpoint[],
    request: tryHttpRequest,
    protocolName: 'HTTP',
  })
}

/**
 * Выполняет RPC запрос к Pocketnet серверу с автоматическим переключением между серверами при ошибках.
 *
 * Логика работы:
 * 1. Если указан config.host/port — использует только указанный сервер (для обратной совместимости).
 * 2. Иначе начинает с сервера 4.pocketnet.app (индекс 3) и идёт по кругу.
 * 3. При «логической» ошибке (структурированной от ноды) — не пробует другие серверы,
 *    кроме случая HTTP-500 с timeout в теле — тогда пробует следующий.
 */
export async function getByPRC(
  params: T_RpcRequestParams,
  config?: RpcRequestConfig
): Promise<unknown> {
  if (config?.host && config?.port) {
    return tryRpcRequest(params, config.host, config.port)
  }

  return retryWithBackoff(params, {
    servers: servers.servers.production.proxy as ServerEndpoint[],
    request: tryRpcRequest,
    isLogicErrorThrowable: true,
    protocolName: 'RPC',
  })
}

/**
 * Выполняет RPC запрос с автоматической подписью (если требуется).
 * Использует useAuthStore для получения ключевой пары и адреса.
 *
 * @example
 * // Запрос с авторизацией (по умолчанию auth: true)
 * const result = await getByPRCWithAuth({
 *   method: 'user.get',
 *   parameters: ['address'],
 * })
 *
 * @example
 * // Запрос без авторизации
 * const result = await getByPRCWithAuth({
 *   method: 'content.get',
 *   parameters: ['post', '123'],
 *   options: { auth: false }
 * })
 */
export async function getByPRCWithAuth(
  params: T_RpcRequestParams,
  config?: RpcRequestConfig
): Promise<unknown> {
  const signed = await signRpcParamsIfNeeded(params)
  return getByPRC(signed, config)
}

// ---------------------------------------------------------------------------
// Typed RPC helpers — use these instead of raw getByPRC + unsafe cast
// ---------------------------------------------------------------------------

import type { BaseRpcResponse } from '@/types/rpc-responses/common'
import { unwrapRpcResponse, unwrapRpcArray } from '@/helpers/common/response-parser'

/**
 * Typed RPC request — returns unwrapped data of type T.
 * Automatically unwraps the standard `{ result, data }` envelope.
 *
 * @throws if the server returns `result === 'error'`
 */
export async function rpcCall<T>(
  params: T_RpcRequestParams,
  config?: RpcRequestConfig
): Promise<T> {
  const raw = (await getByPRC(params, config)) as BaseRpcResponse<T> | T
  if (
    raw &&
    typeof raw === 'object' &&
    'result' in raw &&
    (raw as BaseRpcResponse<T>).result === 'error'
  ) {
    throw new Error((raw as BaseRpcResponse<T>).error ?? 'RPC error')
  }
  const data = unwrapRpcResponse<T>(raw)
  if (data === null) {
    throw new Error('RPC response contained no data')
  }
  return data
}

/** Typed RPC request with auth — returns unwrapped data of type T. */
export async function rpcCallWithAuth<T>(
  params: T_RpcRequestParams,
  config?: RpcRequestConfig
): Promise<T> {
  const raw = (await getByPRCWithAuth(params, config)) as BaseRpcResponse<T> | T
  if (
    raw &&
    typeof raw === 'object' &&
    'result' in raw &&
    (raw as BaseRpcResponse<T>).result === 'error'
  ) {
    throw new Error((raw as BaseRpcResponse<T>).error ?? 'RPC error')
  }
  const data = unwrapRpcResponse<T>(raw)
  if (data === null) {
    throw new Error('RPC response contained no data')
  }
  return data
}

/** Typed RPC request — returns an array of T (safe: always returns []). */
export async function rpcCallArray<T>(
  params: T_RpcRequestParams,
  config?: RpcRequestConfig
): Promise<T[]> {
  const raw = await getByPRC(params, config)
  return unwrapRpcArray<T>(raw)
}

/** Typed RPC request with auth — returns an array of T. */
export async function rpcCallArrayWithAuth<T>(
  params: T_RpcRequestParams,
  config?: RpcRequestConfig
): Promise<T[]> {
  const raw = await getByPRCWithAuth(params, config)
  return unwrapRpcArray<T>(raw)
}
