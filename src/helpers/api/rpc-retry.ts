/**
 * Серверный retry-loop с backoff: пробуем каждый сервер по очереди, начиная с
 * `startIndex` (исторически 4.pocketnet.app), при ошибке — увеличиваем delay
 * для упавшего сервера, при успехе — сбрасываем.
 *
 * Используется и для RPC (getByPRC), и для HTTP (fetchHttp) — единая логика
 * с разным `request`-callback'ом и разной обработкой «логических» ошибок.
 */

import { getBackoffDelay, markServerSuccess, markServerFailure } from './server-backoff'
import { isLogicError, isTimeout500 } from './rpc-errors'

export interface ServerEndpoint {
  host: string
  port: number
}

export interface RetryWithBackoffOptions<P, R> {
  servers: ServerEndpoint[]
  /** С какого индекса начинать (по кругу). По умолчанию 3 — 4.pocketnet.app. */
  startIndex?: number
  /** Колбэк выполнения запроса к конкретному серверу. */
  request: (params: P, host: string, port: number) => Promise<R>
  /** Для RPC — выбрасывать `LogicError` сразу. Для HTTP — пытаемся другой сервер. */
  isLogicErrorThrowable?: boolean
  /** Имя протокола для сообщения «All ... servers failed» (RPC / HTTP). */
  protocolName: 'RPC' | 'HTTP'
}

export async function retryWithBackoff<P, R>(
  params: P,
  opts: RetryWithBackoffOptions<P, R>
): Promise<R> {
  const { servers, request, isLogicErrorThrowable = false, protocolName } = opts
  const startIndex = opts.startIndex ?? 3

  if (!servers || servers.length === 0) {
    throw new Error(`No ${protocolName} servers available`)
  }

  const lastError: Error[] = []

  for (let i = 0; i < servers.length; i++) {
    const serverIndex = (startIndex + i) % servers.length
    const server = servers[serverIndex]!

    const delay = getBackoffDelay(server.host, server.port)
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    try {
      const result = await request(params, server.host, server.port)
      markServerSuccess(server.host, server.port)
      return result
    } catch (error) {
      // Для RPC: если это «логическая» ошибка ноды (валидация, дубль и т.п.) —
      // другие серверы дадут тот же ответ. Исключение — HTTP-500 с timeout в теле:
      // это сетевой сбой замаскированный под код ошибки, продолжаем перебор.
      if (isLogicErrorThrowable && isLogicError(error) && !isTimeout500(error)) {
        throw error
      }

      markServerFailure(server.host, server.port)
      lastError.push(error instanceof Error ? error : new Error(String(error)))

      if (i < servers.length - 1) {
        continue
      }
    }
  }

  if (lastError.length > 0) {
    const errorMessage = `All ${protocolName} servers failed. Last error: ${lastError[lastError.length - 1]!.message}`
    const combinedError = new Error(errorMessage) as Error & { allErrors: Error[] }
    combinedError.allErrors = lastError
    throw combinedError
  }

  throw new Error(`${protocolName} request failed: unknown error`)
}
