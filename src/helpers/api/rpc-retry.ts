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
 *
 * Сеть есть, а интернета нет (reachability): запрос, который ждёт дольше
 * LIVENESS_AFTER_MS, пингует свой прокси и, если тот молчит, обрывается, не
 * дожидаясь 30 с (молчит и на пинг дольше SUSPECT_AFTER_MS — заодно пингуются
 * остальные). После сбоя остальные прокси спрашиваются, только если
 * кто-то ответил на пинг (первыми — ответившие); не ответил никто — перебор
 * кончается с `noProxyAnswered`, а не ждёт таймаута каждого.
 */

import { orderedProxies, markProxyAlive, markProxyDead } from './node-selector'
import { isOfflineNow, OfflineError } from './offline'
import {
  LIVENESS_AFTER_MS,
  SUSPECT_AFTER_MS,
  noteReachable,
  probeRound,
  proxyAnswers,
  type ProbeRound,
} from './reachability'
import { isLogicError, isTimeout500 } from './rpc-errors'

export interface ServerEndpoint {
  host: string
  port: number
}

export interface RetryWithBackoffOptions<P, R> {
  servers: ServerEndpoint[]
  /**
   * Колбэк выполнения запроса к конкретному серверу. `signal` обрывает запрос:
   * прокси не ответил на пинг.
   */
  request: (params: P, host: string, port: number, signal?: AbortSignal) => Promise<R>
  /** Для RPC — выбрасывать `LogicError` сразу. Для HTTP — пытаемся другой сервер. */
  isLogicErrorThrowable?: boolean
  /** Имя протокола для сообщения «All ... servers failed» (RPC / HTTP). */
  protocolName: 'RPC' | 'HTTP'
  /** Сколько ответов «нода не успела» терпеть (по умолчанию MAX_NODE_TIMEOUTS). */
  maxNodeTimeouts?: number
}

/**
 * Ошибка в списке `allErrors`: объект ноды оборачиваем в Error, сохраняя текст
 * и `httpStatus`, — по ним видно, что не успела нода (`isNodeTimeout`).
 */
function toError(error: unknown): Error {
  if (error instanceof Error) return error
  const shape = (error ?? {}) as {
    message?: unknown
    error?: { message?: unknown }
    httpStatus?: unknown
  }
  const message = shape.message ?? shape.error?.message
  const wrapped = new Error(typeof message === 'string' ? message : String(error)) as Error & {
    httpStatus?: unknown
  }
  if (shape.httpStatus !== undefined) wrapped.httpStatus = shape.httpStatus
  return wrapped
}

/** Сколько ответов «нода не успела» (HTTP-500 с timeout) терпеть, прежде чем сдаться. */
const MAX_NODE_TIMEOUTS = 2

/** Перебор кончился, потому что на пинг не ответил ни один прокси. */
export function noProxyAnswered(error: unknown): boolean {
  return (error as { noProxyAnswered?: unknown } | null)?.noProxyAnswered === true
}

/** Хвост очереди: ответившие на пинг — первыми, промолчавшие — в конец. */
function answeredFirst(queue: ServerEndpoint[], from: number, round: ProbeRound): void {
  const rank = (server: ServerEndpoint) => {
    const known = round.known(server)
    return known === true ? 0 : known === undefined ? 1 : 2
  }
  const rest = queue.slice(from).sort((a, b) => rank(a) - rank(b))
  queue.splice(from, rest.length, ...rest)
}

export async function retryWithBackoff<P, R>(
  params: P,
  opts: RetryWithBackoffOptions<P, R>
): Promise<R> {
  const {
    servers,
    request,
    isLogicErrorThrowable = false,
    protocolName,
    maxNodeTimeouts = MAX_NODE_TIMEOUTS,
  } = opts

  if (!servers || servers.length === 0) {
    throw new Error(`No ${protocolName} servers available`)
  }

  // Живая нода первой (с health-пингом на холодном старте), мёртвые в хвосте.
  // Копия: очередь переставляется, а список может быть общим (servers.json).
  const queue = [...(await orderedProxies(servers))]
  const lastError: Error[] = []
  let nodeTimeouts = 0
  let silent = false

  for (let i = 0; i < queue.length; i++) {
    const server = queue[i]!
    const startedAt = Date.now()
    const controller = new AbortController()
    let suspect: ReturnType<typeof setTimeout> | undefined
    // Ждём дольше LIVENESS_AFTER_MS — пингуем этот прокси: молчит — обрываем.
    const liveness = setTimeout(() => {
      suspect = setTimeout(() => void probeRound(servers, startedAt), SUSPECT_AFTER_MS)
      void proxyAnswers(server, startedAt).then((ok) => {
        clearTimeout(suspect)
        if (!ok) controller.abort()
      })
    }, LIVENESS_AFTER_MS)
    try {
      const result = await request(params, server.host, server.port, controller.signal)
      noteReachable()
      markProxyAlive(server)
      return result
    } catch (error) {
      // Для RPC: «логическая» ошибка ноды (валидация, дубль и т.п.) — другие
      // серверы дадут тот же ответ, не перебираем. Исключение — HTTP-500 с
      // timeout в теле: сетевой сбой под видом кода ошибки, продолжаем перебор.
      if (isLogicErrorThrowable && isLogicError(error) && !isTimeout500(error)) {
        noteReachable()
        throw error
      }

      // Сеть пропала посреди перебора: прокси не виноват, остальные не спрашиваем.
      if (isOfflineNow()) throw new OfflineError(protocolName)
      lastError.push(toError(error))
      if (isTimeout500(error)) {
        // Прокси ответил — не успела нода за ним (тяжёлый SQL: лента на редком
        // языке). Прокси живой, а другой прокси спросит другую ноду — но не
        // все подряд: на корейской ленте каждая думала 11–13 с, и запрос
        // висел полторы минуты, а прокси помечались мёртвыми.
        noteReachable()
        markProxyAlive(server)
        if (++nodeTimeouts >= maxNodeTimeouts) break
        continue
      }
      markProxyDead(server)
      // Остальных спрашиваем, только если кто-то ответил на пинг (начатый
      // уже после этой попытки), — первыми ответивших. Молчат все — связи нет
      // (или прокси недоступны): не ждём таймаута каждого.
      const round = probeRound(servers, startedAt)
      if (!(await round.any)) {
        silent = true
        break
      }
      answeredFirst(queue, i + 1, round)
    } finally {
      clearTimeout(liveness)
      clearTimeout(suspect)
    }
  }

  // Первым спрашивался прокси, который считался живым: его ошибка обычно и
  // есть причина. Последняя — часто от мёртвого прокси из хвоста очереди, и
  // по ней одной причину было не понять («Request canceled» висящего 4-го).
  const first = lastError[0]
  const last = lastError[lastError.length - 1]
  const firstPart =
    first && first.message !== last?.message ? `. First error: ${first.message}` : ''
  const errorMessage = `All ${protocolName} servers failed. Last error: ${last?.message ?? 'unknown error'}${firstPart}`
  const combinedError = new Error(errorMessage) as Error & {
    allErrors: Error[]
    noProxyAnswered?: true
  }
  combinedError.allErrors = lastError
  if (silent) combinedError.noProxyAnswered = true
  throw combinedError
}
