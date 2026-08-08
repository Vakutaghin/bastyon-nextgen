/**
 * Failover-loop по прокси-серверам с health-aware выбором живой ноды.
 *
 * Порядок серверов даёт `node-selector` (живая нода первой, мёртвые в хвосте),
 * сам запрос (`request`) имеет собственный таймаут — поэтому мёртвая нода
 * отваливается быстро, а не висит до сетевого таймаута ОС. На успехе помечаем
 * ноду живой (стикинесс), на ошибке транспорта — мёртвой (следующий запрос
 * перевыберет).
 *
 * Используется и для RPC (getByPRC), и для HTTP (fetchHttp) — единая логика
 * с разным `request`-callback'ом и разной обработкой «логических» ошибок.
 */

import { orderedProxies, markProxyAlive, markProxyDead } from './node-selector'
import { isLogicError, isTimeout500 } from './rpc-errors'

export interface ServerEndpoint {
  host: string
  port: number
}

export interface RetryWithBackoffOptions<P, R> {
  servers: ServerEndpoint[]
  /** Колбэк выполнения запроса к конкретному серверу. */
  request: (params: P, host: string, port: number) => Promise<R>
  /** Для RPC — выбрасывать `LogicError` сразу. Для HTTP — пытаемся другой сервер. */
  isLogicErrorThrowable?: boolean
  /** Имя протокола для сообщения «All ... servers failed» (RPC / HTTP). */
  protocolName: 'RPC' | 'HTTP'
}

export async function retryWithBackoff<P, R>(
  params: P,
  opts: RetryWithBackoffOptions<P, R>,
): Promise<R> {
  const { servers, request, isLogicErrorThrowable = false, protocolName } = opts

  if (!servers || servers.length === 0) {
    throw new Error(`No ${protocolName} servers available`)
  }

  // Живая нода первой (с health-пингом на холодном старте), мёртвые в хвосте.
  const ordered = await orderedProxies(servers)
  const lastError: Error[] = []

  for (const server of ordered) {
    try {
      const result = await request(params, server.host, server.port)
      markProxyAlive(server)
      return result
    } catch (error) {
      // Для RPC: «логическая» ошибка ноды (валидация, дубль и т.п.) — другие
      // серверы дадут тот же ответ, не перебираем. Исключение — HTTP-500 с
      // timeout в теле: сетевой сбой под видом кода ошибки, продолжаем перебор.
      if (isLogicErrorThrowable && isLogicError(error) && !isTimeout500(error)) {
        throw error
      }

      markProxyDead(server)
      lastError.push(error instanceof Error ? error : new Error(String(error)))
    }
  }

  const last = lastError[lastError.length - 1]
  const errorMessage = `All ${protocolName} servers failed. Last error: ${last?.message ?? 'unknown error'}`
  const combinedError = new Error(errorMessage) as Error & { allErrors: Error[] }
  combinedError.allErrors = lastError
  throw combinedError
}
