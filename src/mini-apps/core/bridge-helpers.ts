/**
 * Внутренние утилиты {@link MiniAppsBridge}: shared state, postRaw, нормализация ошибок,
 * форматтер лога. Вынесено из bridge.ts, чтобы handler-функции (rpc/fetch/listeners)
 * могли работать с общим state без приватных методов класса.
 */

import { logger } from '@/services/logger'
import type { IncomingMessage, OutgoingMessage, RpcError } from '../types/messages'
import type { AppId, InstalledApp } from '../types/app'
import type { AppOriginResolver } from './origin-guard'
import type { FetchRequest, FetchResponse, Payload } from '../types/messages'

const log = logger.scope('[mini-apps:bridge]')

/** Стандартный таймаут на один RPC. Конкретные actions могут переопределять. */
export const DEFAULT_RPC_TIMEOUT_MS = 30_000

export interface RpcContext {
  readonly app: InstalledApp
  readonly action: string
  readonly data: unknown
  readonly signal: AbortSignal
}

export interface BridgeOptions {
  resolver: AppOriginResolver

  /** Выполняет RPC. Должен либо вернуть результат, либо бросить ошибку. */
  dispatchRpc(ctx: RpcContext): Promise<Payload>

  /** Колбэк когда iframe зарегистрировал push-listener (для UI «приложение загружено»). */
  onListenerRegistered?(app: InstalledApp, listenerId: string): void

  /** Колбэк fire-and-forget событий от iframe (`loaded`, `changestate`, ...). */
  onIframeEvent?(app: InstalledApp, event: string, data: unknown): void

  /** Обработчик SW-туннеля. Если не задан — FETCH_REQUEST отвергается. */
  onFetchRequest?(app: InstalledApp, req: FetchRequest): Promise<FetchResponse>

  /** Таймаут на RPC. Default — {@link DEFAULT_RPC_TIMEOUT_MS}. */
  rpcTimeoutMs?: number
}

export interface AppConnection {
  /** Окно iframe для отправки сообщений. Сохраняем из event.source. */
  window: MessageEventSource
  /** Канонический origin приложения для targetOrigin. */
  origin: string
  /** ID push-канала, сообщённый миниаппой через `{id, listener}`. Null если ещё не регистрировался. */
  listenerId: string | null
}

/**
 * Контекст, который handler-функции получают в качестве первого аргумента.
 * Содержит ровно те части bridge-state, что им нужны — без приватных полей класса.
 */
export interface BridgeRouterState {
  readonly connections: Map<AppId, AppConnection>
  readonly inflight: Map<string, AbortController>
  readonly opts: BridgeOptions
  postRaw(conn: AppConnection, message: OutgoingMessage): void
}

export function postRaw(conn: AppConnection, message: OutgoingMessage): void {
  // `structuredClone` (использует postMessage) НЕ умеет в Vue/Pinia reactive Proxy
  // объекты (DataCloneError) — а response часто содержит данные из сторов
  // (например `app.manifest` в appinfo). Делаем JSON-roundtrip как универсальный
  // распроксиватель: дёшево, гарантированно даёт plain-объекты, и заодно
  // отсекает функции/символы/циклы которые в postMessage всё равно нельзя.
  let cloned: OutgoingMessage
  try {
    cloned = JSON.parse(JSON.stringify(message)) as OutgoingMessage
  } catch (err) {
    log.warn('postMessage: response is not JSON-serializable', err, message)
    return
  }
  try {
    conn.window.postMessage(cloned, { targetOrigin: conn.origin })
  } catch (err) {
    log.warn('postMessage failed', err)
  }
}

export function getMsgExtra(msg: IncomingMessage): string {
  switch (msg.kind) {
    case 'rpc':
      return msg.message.action
    case 'event':
      return msg.message.event
    case 'listener':
      return msg.message.listener
    case 'fetch':
      return 'fetch'
  }
}

export function normalizeError(err: unknown, signal: AbortSignal): RpcError['error'] {
  if (signal.aborted) {
    return {
      message: 'rpc_timeout',
      name: 'TimeoutError',
      code: 'timeout',
    }
  }
  if (err instanceof Error) {
    const out: RpcError['error'] = {
      message: err.message || 'unknown error',
      name: err.name,
      stack: err.stack,
    }
    // Известные action-registry / rate-limiter ошибки несут машинно-читаемый
    // `code` и (для rate-limit) `retryAfterMs`. Пробрасываем их в `RpcError`,
    // чтобы SDK миниаппы мог реагировать программно.
    const code = (err as { code?: unknown }).code
    if (typeof code === 'string') out.code = code
    const retryAfter = (err as { retryAfterMs?: unknown }).retryAfterMs
    if (typeof retryAfter === 'number') out.retryAfter = retryAfter
    return out
  }
  if (typeof err === 'string') {
    return { message: err, name: 'Error' }
  }
  return { message: 'unknown error', name: 'Error' }
}
