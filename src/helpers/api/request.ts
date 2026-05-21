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

/** Fetch for Matrix/chat: routes through Tor when enabled, plugin-http for cross-origin
 *  (CORS bypass), and plain browser fetch for same-origin (Vite dev proxy). */
export async function matrixFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return appFetch(input, init)
}

// ---------------------------------------------------------------------------
// Tor-aware fetch
// ---------------------------------------------------------------------------

/**
 * Universal fetch wrapper. If Tor is enabled and ready, the request is sent
 * through a Tauri command that pipes it via SOCKS5; otherwise the standard
 * fetch path is used. Same-origin requests (relative paths or same origin
 * as `window.location`) always use the plain browser `fetch` so the dev
 * server's proxy keeps working in `tauri:dev`.
 */
export async function appFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url

  // Vite dev proxy / same-origin: bypass plugin-http and Tor.
  if (isSameOriginUrl(url)) {
    return globalThis.fetch(input, init)
  }
  if (await shouldTorifyRequest()) {
    return torFetch(input, init)
  }
  const tauriF = await getTauriFetch()
  return (tauriF ?? globalThis.fetch)(input, init)
}

async function shouldTorifyRequest(): Promise<boolean> {
  if (!isTauriEnv()) return false
  try {
    const { useTorStore } = await import('@/stores/tor-store')
    const store = useTorStore()
    return store.shouldTorify
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Debug helpers — exposed on `window.__torDebug` for live introspection.
// ---------------------------------------------------------------------------

type TorDebugEntry = {
  url: string
  usedTor: boolean
  durationMs: number
  error?: string
  at: number
}

type TorDebugStats = {
  enabled: boolean
  through: number
  direct: number
  failed: number
  recent: TorDebugEntry[]
  lastUrl?: string
}

const TOR_DEBUG_KEY = '__torDebug'
const TOR_DEBUG_RECENT_LIMIT = 50

function recordTorRequest(
  url: string,
  usedTor: boolean,
  durationMs: number,
  error?: string
): void {
  const stats = ensureDebug()._stats
  if (error) stats.failed += 1
  else if (usedTor) stats.through += 1
  else stats.direct += 1
  stats.lastUrl = url
  const entry: TorDebugEntry = { url, usedTor, durationMs, error, at: Date.now() }
  stats.recent.push(entry)
  if (stats.recent.length > TOR_DEBUG_RECENT_LIMIT) {
    stats.recent.shift()
  }
}

function ensureDebug(): {
  _stats: TorDebugStats
  summary: () => TorDebugStats
  recent: () => TorDebugEntry[]
  reset: () => void
  checkIp: () => Promise<{ direct: string; viaTor: string | null; same: boolean }>
} {
  const w = globalThis as unknown as Record<string, unknown>
  const existing = w[TOR_DEBUG_KEY] as ReturnType<typeof ensureDebug> | undefined
  if (existing) return existing
  const stats: TorDebugStats = {
    enabled: false,
    through: 0,
    direct: 0,
    failed: 0,
    recent: [],
  }
  const debug = {
    _stats: stats,
    summary(): TorDebugStats {
      return { ...stats, recent: stats.recent.slice() }
    },
    recent(): TorDebugEntry[] {
      return stats.recent.slice()
    },
    reset(): void {
      stats.through = 0
      stats.direct = 0
      stats.failed = 0
      stats.recent.length = 0
      stats.lastUrl = undefined
    },
    async checkIp(): Promise<{ direct: string; viaTor: string | null; same: boolean }> {
      const directResp = await globalThis.fetch('https://api.ipify.org?format=json')
      const direct = (await directResp.json()).ip as string
      let viaTor: string | null = null
      try {
        const r = await appFetch('https://api.ipify.org?format=json')
        viaTor = (await r.json()).ip as string
      } catch (e) {
        viaTor = `error: ${(e as Error).message}`
      }
      return { direct, viaTor, same: direct === viaTor }
    },
  }
  w[TOR_DEBUG_KEY] = debug
  return debug
}

// Initialise lazily when this module first loads in a window.
if (typeof window !== 'undefined') {
  ensureDebug()
}

function isSameOriginUrl(url: string): boolean {
  if (!url) return false
  // Relative URLs are always same-origin.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return true
  if (typeof window === 'undefined') return false
  try {
    return new URL(url).origin === window.location.origin
  } catch {
    return false
  }
}

type TorFetchRequest = {
  url: string
  method: string
  headers: Record<string, string>
  body_b64?: string
  timeout_ms?: number
}

type TorFetchResponse = {
  status: number
  status_text: string
  headers: Array<[string, string]>
  body_b64: string
  final_url: string
  used_tor: boolean
}

async function torFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (init?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const url = inputToUrl(input)
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = headersToRecord(input, init)
  const bodyBytes = await bodyToBytes(init?.body, headers)

  const req: TorFetchRequest = {
    url,
    method,
    headers,
    body_b64: bodyBytes ? bytesToBase64(bodyBytes) : undefined,
  }

  const { invoke } = await import('@tauri-apps/api/core')
  let resp: TorFetchResponse
  const startedAt = performance.now()
  try {
    resp = await invoke<TorFetchResponse>('tor_fetch', { req })
  } catch (e) {
    const message = typeof e === 'string' ? e : (e as Error)?.message ?? JSON.stringify(e)
    recordTorRequest(url, false, performance.now() - startedAt, message)
    throw new Error(`tor_fetch failed (${url}): ${message}`)
  }
  recordTorRequest(url, resp.used_tor, performance.now() - startedAt)

  const responseHeaders = new Headers()
  for (const [k, v] of resp.headers) {
    try {
      responseHeaders.append(k, v)
    } catch {
      // ignore non-conformant headers (e.g. Set-Cookie variants)
    }
  }

  const bodyBuf = base64ToBytes(resp.body_b64)
  return new Response(bodyBuf as unknown as BodyInit, {
    status: resp.status,
    statusText: resp.status_text,
    headers: responseHeaders,
  })
}

function inputToUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function headersToRecord(
  input: RequestInfo | URL,
  init?: RequestInit
): Record<string, string> {
  const out: Record<string, string> = {}
  const collect = (h: HeadersInit) => {
    if (h instanceof Headers) {
      h.forEach((v, k) => {
        out[k] = v
      })
    } else if (Array.isArray(h)) {
      for (const [k, v] of h) out[k] = v
    } else {
      Object.assign(out, h)
    }
  }
  if (input instanceof Request && input.headers) collect(input.headers)
  if (init?.headers) collect(init.headers)
  return out
}

async function bodyToBytes(
  body: BodyInit | null | undefined,
  headers: Record<string, string>
): Promise<Uint8Array | undefined> {
  if (body == null) return undefined
  if (typeof body === 'string') {
    return new TextEncoder().encode(body)
  }
  if (body instanceof Uint8Array) return body
  if (body instanceof ArrayBuffer) return new Uint8Array(body)
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    const buf = await body.arrayBuffer()
    return new Uint8Array(buf)
  }
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    if (!hasHeader(headers, 'content-type')) {
      headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
    }
    return new TextEncoder().encode(body.toString())
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    // Encode FormData via Request to get a multipart body the same way fetch would.
    const tmp = new Request('http://localhost', { method: 'POST', body })
    const buf = await tmp.arrayBuffer()
    const ctype = tmp.headers.get('content-type')
    if (ctype && !hasHeader(headers, 'content-type')) {
      headers['content-type'] = ctype
    }
    return new Uint8Array(buf)
  }
  // Fallback: treat as string-like.
  return new TextEncoder().encode(String(body))
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lc = name.toLowerCase()
  return Object.keys(headers).some((k) => k.toLowerCase() === lc)
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[]
    )
  }
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
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
    const server = availableServers[serverIndex]!

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
    const errorMessage = `All HTTP servers failed. Last error: ${lastError[lastError.length - 1]!.message}`
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
    const server = availableServers[serverIndex]!

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
    const errorMessage = `All RPC servers failed. Last error: ${lastError[lastError.length - 1]!.message}`
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
