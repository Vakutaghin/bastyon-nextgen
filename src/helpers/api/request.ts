import servers from '@/servers.json'
import { getRpcPath } from './rpc-endpoints'
import {
  getBackoffDelay,
  markServerSuccess,
  markServerFailure,
} from './server-backoff'

/** Tauri 1/2 detection: __TAURI__, __TAURI_INTERNALS__, __TAURI_METADATA__, or any __TAURI* key. */
function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as any
  if (typeof w.__TAURI__ !== 'undefined') return true
  if (typeof w.__TAURI_INTERNALS__ !== 'undefined') return true
  if (typeof w.__TAURI_METADATA__ !== 'undefined') return true
  try {
    if (Object.keys(w).some((k) => k.startsWith('__TAURI'))) return true
  } catch {}
  return false
}

/** In Tauri production, browser fetch hits CORS (e.g. Authorization not allowed). Plugin-http bypasses CORS. */
export async function getTauriFetch(): Promise<typeof globalThis.fetch | undefined> {
  const isTauri = isTauriEnv() || (import.meta.env?.VITE_TAURI === 'true')
  if (!isTauri) return undefined
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch as typeof globalThis.fetch
  } catch {
    return undefined
  }
}

/** Fetch for Matrix/chat: uses Tauri fetch in Tauri app (bypasses CORS), else global fetch. */
export async function matrixFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const fn = await getTauriFetch()
  return (fn ?? globalThis.fetch)(input, init)
}

export type RpcOptions = {
  node?: string
  cache?: boolean
  fastvideo?: boolean
  ex?: boolean
  /** Требуется ли авторизация (подпись запроса) */
  auth?: boolean
  /** Сессия для подписи */
  session?: string
  [key: string]: unknown
}

export type T_RpcRequestParams = {
  method: string
  parameters: unknown[]
  cachehash?: string
  options?: RpcOptions
  state?: number
  /** Подпись запроса (добавляется автоматически если auth: true) */
  signature?: unknown
}

export type RpcRequestConfig = {
  host?: string
  port?: number
}

export type HttpRequestOptions = {
  /** Требуется ли авторизация (подпись запроса) */
  auth?: boolean
  /** Сессия для подписи */
  session?: string
  /** Прокси ID (если нужно использовать конкретный прокси) */
  proxy?: string
  /** Таймаут запроса в миллисекундах */
  timeout?: number
  /** Конкретный хост прокси (для запросов к определённому серверу) */
  host?: string
  /** Конкретный порт прокси (для запросов к определённому серверу) */
  port?: number
}

export type HttpRequestParams = {
  /** Путь к endpoint (например, 'free/balance', 'captcha') */
  path: string
  /** Данные для отправки */
  data: Record<string, unknown>
  /** Опции запроса */
  options?: HttpRequestOptions
}

/**
 * Выполняет RPC запрос к одному конкретному серверу
 * @param params - Параметры запроса
 * @param host - Хост сервера
 * @param port - Порт сервера
 * @returns Promise с результатом запроса
 */
async function tryRpcRequest(
  params: T_RpcRequestParams,
  host: string,
  port: number
): Promise<unknown> {
  const useEx = params.options?.ex === true
  const path = getRpcPath(params.method, useEx)
  const url = `https://${host}:${port}${path}`

  const response = await fetch(url, {
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
    // Если не удалось распарсить JSON, выбрасываем ошибку
    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`)
    }
    throw new Error(`RPC request failed: Invalid JSON response`)
  }

    // Если статус не OK, проверяем, является ли это ожидаемой ошибкой
    if (!response.ok) {
      // Для user.get 500 может означать "аккаунт не найден" (незарегистрирован)
      // Это нормальная ситуация, не ошибка
      if (params.method === 'user.get' && response.status === 500) {
        // Возвращаем пустой результат вместо ошибки
        return { data: null }
      }

      // Если ответ содержит JSON с ошибкой, выбрасываем его как объект
      if (responseData && typeof responseData === 'object' && 'error' in responseData) {
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         throw (responseData as any).error || responseData
      }

      // Для других методов или статусов - выбрасываем ошибку
      const errorMessage = (responseData as any)?.error || (responseData as any)?.message || `RPC request failed: ${response.status} ${response.statusText}`
      throw new Error(errorMessage)
    }

    // Если статус OK, но есть error в ответе (нестандартное поведение некоторых методов)
    if (responseData && typeof responseData === 'object' && 'error' in responseData && (responseData as any).error) {
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       throw (responseData as any).error
    }

    return responseData
}

/**
 * Выполняет HTTP запрос к одному конкретному серверу
 */
async function tryHttpRequest(
  params: HttpRequestParams,
  host: string,
  port: number
): Promise<unknown> {
  const { path, data, options } = params

  // Определяем, требуется ли авторизация
  const requiresAuth = options?.auth !== false

  // Если требуется авторизация, получаем ключевую пару и адрес
  let signedData = { ...data }
  if (requiresAuth) {
    const { useAuthStore } = await import('@/blockchain/store/auth-store')
    const { signRequest } = await import('@/blockchain/api/request-signer')

    const authStore = useAuthStore()
    const keyPair = authStore.getKeyPair
    const address = authStore.getUserAddress

    if (keyPair && address) {
      // Подписываем данные запроса напрямую (для HTTP запросов)
      signedData = signRequest(
        data,
        keyPair,
        address,
        {
          requireSignature: true,
          session: options?.session,
        }
      ) as Record<string, unknown>

      // Проверяем, что подпись была добавлена
      if (!signedData.signature) {
        console.error('Signature was not added to request data', {
          path,
          hasKeyPair: !!keyPair,
          hasAddress: !!address,
          dataKeys: Object.keys(data),
          signedDataKeys: Object.keys(signedData)
        })
        throw new Error('Failed to generate signature for request')
      }

      // Логируем информацию о подписи для отладки (только для капчи)
      if (path.includes('captcha') || path.includes('makecaptcha')) {
        const sig = signedData.signature as Record<string, unknown> | undefined
        console.debug('Captcha request signature', {
          path,
          hasSignature: !!signedData.signature,
          signatureType: typeof signedData.signature,
          isObject: typeof signedData.signature === 'object',
          hasAddress: !!(sig && 'address' in sig),
          address: (sig && 'address' in sig ? sig.address : null) || address,
          signatureKeys: sig ? Object.keys(sig) : [],
        })
      }
    } else if (authStore.isUserAuthenticated) {
      // Если авторизован, но нет ключей, добавляем state
      signedData.state = 1
    } else {
      // Если не авторизован, но требуется авторизация
      // Для endpoints капчи авторизация обязательна
      // Avoid leaking internal auth state in production logs
      console.warn('[request] Auth required but user not authenticated for', path)
      throw new Error('Authentication required for this request. Please ensure you are registered and logged in.')
    }
  }

  // Формируем URL
  const url = `https://${host}:${port}/${path}`

  // Выполняем запрос
  const controller = new AbortController()
  const timeout = options?.timeout || 30000
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
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

      // Специальная обработка ошибки 401 (Unauthorized)
      if (response.status === 401) {
        console.warn('[request] Auth failed for', path)
        throw new Error(`Authentication failed: ${errorMessage}`)
      }

      throw new Error(errorMessage)
    }

    const result = await response.json()

    // Проверяем наличие ошибки в ответе
    if (result.error) {
      // Специальная обработка ошибки авторизации
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
      throw new Error('Request timeout')
    }

    throw error
  }
}

/**
 * Выполняет HTTP запрос к Pocketnet серверу с автоматическим переключением между серверами
 * Использует механизм backoff для оптимизации запросов
 *
 * @param params - Параметры запроса
 * @returns Promise с результатом запроса
 */
export async function fetchHttp(
  params: HttpRequestParams
): Promise<unknown> {
  // Если указан конкретный host:port — обращаемся только к нему (для прокси с кошельком и т. п.)
  if (params.options?.host && params.options?.port) {
    return tryHttpRequest(params, params.options.host, params.options.port)
  }

  // Получаем список доступных серверов
  const availableServers = servers.servers.production.proxy

  if (!availableServers || availableServers.length === 0) {
    throw new Error('No HTTP servers available')
  }

  // Начинаем с индекса 3 (4.pocketnet.app), как в старом приложении
  const startIndex = 3
  const lastError: Error[] = []

  // Пробуем все серверы, начиная с startIndex, затем по кругу
  for (let i = 0; i < availableServers.length; i++) {
    const serverIndex = (startIndex + i) % availableServers.length
    const server = availableServers[serverIndex]

    // Получаем задержку для этого сервера (на основе предыдущих неудач)
    const delay = getBackoffDelay(server.host, server.port)

    // Если есть задержка, ждем перед запросом
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    try {
      const result = await tryHttpRequest(params, server.host, server.port)

      // Успешный запрос - сбрасываем задержку для этого сервера
      markServerSuccess(server.host, server.port)

      return result
    } catch (error) {
      // Неудачный запрос - увеличиваем задержку для следующего круга
      markServerFailure(server.host, server.port)

      // Сохраняем ошибку для последующего выброса, если все серверы недоступны
      lastError.push(error instanceof Error ? error : new Error(String(error)))

      // Если это не последняя попытка, продолжаем со следующим сервером
      if (i < availableServers.length - 1) {
        continue
      }
    }
  }

  // Если все серверы недоступны, выбрасываем последнюю ошибку
  if (lastError.length > 0) {
    const errorMessage = `All HTTP servers failed. Last error: ${lastError[lastError.length - 1].message}`
    const combinedError = new Error(errorMessage)
    ;(combinedError as any).allErrors = lastError
    throw combinedError
  }

  throw new Error('HTTP request failed: unknown error')
}

/**
 * Выполняет RPC запрос к Pocketnet серверу с автоматическим переключением между серверами при ошибках
 *
 * Логика работы:
 * 1. Если указан config.host/port - использует только указанный сервер (для обратной совместимости)
 * 2. Если config не указан - начинает с сервера 4.pocketnet.app (индекс 3) как в старом приложении
 * 3. При ошибке автоматически переключается на следующий сервер из списка
 * 4. Пробует все доступные серверы по кругу
 *
 * @param params - Параметры запроса
 * @param config - Конфигурация (хост, порт). Если указан, используется только этот сервер
 * @returns Promise с результатом запроса
 */
export async function getByPRC(
  params: T_RpcRequestParams,
  config?: RpcRequestConfig
): Promise<unknown> {
  // Если указан явный host/port в config, используем только его (для обратной совместимости)
  if (config?.host && config?.port) {
    return tryRpcRequest(params, config.host, config.port)
  }

  // Получаем список доступных серверов
  const availableServers = servers.servers.production.proxy

  if (!availableServers || availableServers.length === 0) {
    throw new Error('No RPC servers available')
  }

  // Начинаем с индекса 3 (4.pocketnet.app), как в старом приложении
  const startIndex = 3
  const lastError: Error[] = []

  // Пробуем все серверы, начиная с startIndex, затем по кругу
  for (let i = 0; i < availableServers.length; i++) {
    const serverIndex = (startIndex + i) % availableServers.length
    const server = availableServers[serverIndex]

    // Получаем задержку для этого сервера (на основе предыдущих неудач)
    const delay = getBackoffDelay(server.host, server.port)

    // Если есть задержка, ждем перед запросом
    // Первый сервер в круге (i === 0) запрашивается сразу без задержки
    // Последующие серверы с задержкой будут ждать перед запросом
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    try {
      const result = await tryRpcRequest(params, server.host, server.port)

      // Успешный запрос - сбрасываем задержку для этого сервера
      markServerSuccess(server.host, server.port)

      return result
    } catch (error) {
      // Если это ошибка логики (например, неверные входные данные, двойная оценка),
      // а не сетевая ошибка или ошибка сервера (500), то нет смысла пробовать другие серверы
      // Мы определяем это по наличию кода ошибки в объекте error
      const isLogicError = (
        error
        && typeof error === 'object'
        && (
          'code' in error
          || ('error' in error && 'code' in (error as any).error)
        )
      )

      // Проверяем, является ли это ошибкой 500 с таймаутом
      // В этом случае мы хотим попробовать другой сервер, даже если есть код ошибки
      // Также проверяем вложенные JSON строки, которые могут содержаться в message
      let isTimeout500 = (error as any)?.httpStatus === 500

      if (isTimeout500) {
        const errorMsg = (error as any)?.message || (error as any)?.error?.message || ''
        const errorMsgLower = errorMsg.toLowerCase()

        // Прямая проверка на 'timeout'
        if (errorMsgLower.includes('timeout')) {
          isTimeout500 = true
        } else {
          // Попытка распарсить JSON внутри сообщения об ошибке
          // Пример: "{\"code\":408,\"message\":\"GetAccountProfiles: sql request timeout\"}"
          try {
             // Ищем JSON-подобную структуру
             const jsonMatch = errorMsg.match(/\{.*\}/)
             if (jsonMatch) {
               const parsed = JSON.parse(jsonMatch[0])
               const parsedMsg = parsed.message || parsed.error
               if (parsedMsg && typeof parsedMsg === 'string' && parsedMsg.toLowerCase().includes('timeout')) {
                 isTimeout500 = true
               } else {
                 isTimeout500 = false
               }
             } else {
               isTimeout500 = false
             }
          } catch (e) {
            isTimeout500 = false
          }
        }
      }

      if (isLogicError && !isTimeout500) {
        throw error
      }

      // Неудачный запрос - увеличиваем задержку для следующего круга
      markServerFailure(server.host, server.port)

      // Сохраняем ошибку для последующего выброса, если все серверы недоступны
      lastError.push(error instanceof Error ? error : new Error(String(error)))

      // Если это не последняя попытка, продолжаем со следующим сервером
      if (i < availableServers.length - 1) {
        continue
      }
    }
  }

  // Если все серверы недоступны, выбрасываем последнюю ошибку
  // или общую ошибку, если ошибок не было
  if (lastError.length > 0) {
    const errorMessage = `All RPC servers failed. Last error: ${lastError[lastError.length - 1].message}`
    const combinedError = new Error(errorMessage)
    // Сохраняем все ошибки для отладки
    ;(combinedError as any).allErrors = lastError
    throw combinedError
  }

  throw new Error('RPC request failed: unknown error')
}

/**
 * Выполняет RPC запрос с автоматической подписью (если требуется)
 * Использует useAuthStore для получения ключевой пары и адреса
 *
 * @param params - Параметры запроса
 * @param config - Конфигурация (хост, порт)
 * @returns Promise с результатом запроса
 *
 * @example
 * // Запрос с авторизацией (по умолчанию auth: true)
 * const result = await getByPRCWithAuth({
 *   method: 'user.get',
 *   parameters: ['address'],
 * })
 *
 * @example
 * // Запрос с явным указанием авторизации
 * const result = await getByPRCWithAuth({
 *   method: 'content.add',
 *   parameters: [...],
 *   options: { auth: true }
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
  // Динамический импорт для избежания циклических зависимостей
  const { useAuthStore } = await import('@/blockchain/store/auth-store')
  const { signRequest } = await import('@/blockchain/api/request-signer')

  const authStore = useAuthStore()

  // Определяем, требуется ли авторизация
  // По умолчанию auth: true (если не указано явно false)
  const requiresAuth = params.options?.auth !== false

  if (requiresAuth) {
    // Получаем ключевую пару и адрес из store
    const keyPair = authStore.getKeyPair
    const address = authStore.getUserAddress

    if (keyPair && address) {
      // Пользователь авторизован - подписываем запрос
      params = signRequest(
        params,
        keyPair,
        address,
        {
          requireSignature: true,
          session: params.options?.session,
        }
      ) as T_RpcRequestParams
    } else if (authStore.isUserAuthenticated) {
      // Пользователь авторизован, но нет ключей (не должно происходить)
      // Добавляем state для совместимости
      params.state = 1
    }
    // Если пользователь не авторизован, запрос отправляется без подписи
    // Сервер вернет ошибку, если требуется авторизация
  } else {
    // Авторизация не требуется - запрос отправляется как есть
    // Но если пользователь авторизован, можно добавить state
    if (authStore.isUserAuthenticated) {
      params.state = 1
    }
  }

  return getByPRC(params, config)
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
  const raw = await getByPRC(params, config) as BaseRpcResponse<T> | T
  if (raw && typeof raw === 'object' && 'result' in raw && (raw as BaseRpcResponse<T>).result === 'error') {
    throw new Error((raw as BaseRpcResponse<T>).error ?? 'RPC error')
  }
  const data = unwrapRpcResponse<T>(raw)
  if (data === null) {
    throw new Error('RPC response contained no data')
  }
  return data
}

/**
 * Typed RPC request with auth — returns unwrapped data of type T.
 */
export async function rpcCallWithAuth<T>(
  params: T_RpcRequestParams,
  config?: RpcRequestConfig
): Promise<T> {
  const raw = await getByPRCWithAuth(params, config) as BaseRpcResponse<T> | T
  if (raw && typeof raw === 'object' && 'result' in raw && (raw as BaseRpcResponse<T>).result === 'error') {
    throw new Error((raw as BaseRpcResponse<T>).error ?? 'RPC error')
  }
  const data = unwrapRpcResponse<T>(raw)
  if (data === null) {
    throw new Error('RPC response contained no data')
  }
  return data
}

/**
 * Typed RPC request — returns an array of T (safe: always returns []).
 */
export async function rpcCallArray<T>(
  params: T_RpcRequestParams,
  config?: RpcRequestConfig
): Promise<T[]> {
  const raw = await getByPRC(params, config)
  return unwrapRpcArray<T>(raw)
}

/**
 * Typed RPC request with auth — returns an array of T.
 */
export async function rpcCallArrayWithAuth<T>(
  params: T_RpcRequestParams,
  config?: RpcRequestConfig
): Promise<T[]> {
  const raw = await getByPRCWithAuth(params, config)
  return unwrapRpcArray<T>(raw)
}
