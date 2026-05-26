/**
 * Bridge — singleton-арбитр между host-страницей и iframe-ами мини-приложений.
 *
 * Отвечает за:
 * - подписку на `window.message`;
 * - валидацию origin'а (через {@link AppOriginResolver});
 * - типизированный разбор сообщений (через `parseIncomingMessage`);
 * - маршрутизацию RPC-вызовов в `dispatchRpc`;
 * - регистрацию push-listener'ов и отправку push-событий из хоста в iframe;
 * - таймауты на RPC через AbortSignal (закрывает 1.3);
 * - корректную отправку ответов с `targetOrigin = canonical origin` (закрывает 1.2).
 *
 * Bridge **не знает** про конкретные actions, permissions, или Pinia. Это
 * чистый wire-уровень. Все доменные действия инжектятся снаружи через
 * {@link BridgeOptions}.
 */

import { logger } from '@/services/logger'
import { parseIncomingMessage, rpcError, rpcSuccess, pushEvent } from '../types/messages'
import type {
  IncomingMessage,
  OutgoingMessage,
  Payload,
  RpcError,
  FetchRequest,
  FetchResponse,
} from '../types/messages'
import type { InstalledApp, AppId } from '../types/app'
import { type AppOriginResolver, safeNormalizeOrigin } from './origin-guard'

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

interface AppConnection {
  /** Окно iframe для отправки сообщений. Сохраняем из event.source. */
  window: MessageEventSource
  /** Канонический origin приложения для targetOrigin. */
  origin: string
  /** ID push-канала, сообщённый миниаппой через `{id, listener}`. Null если ещё не регистрировался. */
  listenerId: string | null
}

export class MiniAppsBridge {
  private connections = new Map<AppId, AppConnection>()
  private inflight = new Map<string, AbortController>() // requestId → controller
  private opts: BridgeOptions | null = null
  private started = false
  private boundHandler = this.onMessage.bind(this)

  /** Активирует bridge: подписывается на `window.message`. Можно вызывать только один раз. */
  start(opts: BridgeOptions): void {
    if (this.started) {
      log.warn('start() called twice — ignoring')
      return
    }
    this.opts = opts
    window.addEventListener('message', this.boundHandler)
    this.started = true
    log.debug('started')
  }

  /** Останавливает bridge: снимает listener'ы, отменяет inflight RPC, чистит connections. */
  stop(): void {
    if (!this.started) return
    window.removeEventListener('message', this.boundHandler)
    for (const ctrl of this.inflight.values()) ctrl.abort()
    this.inflight.clear()
    this.connections.clear()
    this.opts = null
    this.started = false
    log.debug('stopped')
  }

  /** Шлёт push-событие конкретному приложению. Возвращает `true` если доставлено. */
  push(appId: AppId, key: string, data: Payload): boolean {
    const conn = this.connections.get(appId)
    if (!conn || !conn.listenerId) return false
    this.postRaw(conn, pushEvent(conn.listenerId, key, data))
    return true
  }

  /** Шлёт push-событие всем активным мини-приложениям. */
  pushAll(key: string, data: Payload): void {
    for (const [appId] of this.connections) {
      this.push(appId, key, data)
    }
  }

  /** Удаляет состояние приложения. Вызывается при размонтировании iframe. */
  unregisterApp(appId: AppId): void {
    this.connections.delete(appId)
    // Прерывать inflight RPC по appId дороже, чем нужно — RPC сам уйдёт в void
    // когда не сможет отправить ответ. Но если очень хочется — можно фильтровать
    // inflight по appId-префиксу в requestId. Пока оставим как есть.
  }

  /** Список текущих активных приложений (зарегистрировавших окно). */
  activeApps(): AppId[] {
    return [...this.connections.keys()]
  }

  // ─── приватная кухня ──────────────────────────────────────────────────────

  private onMessage(event: MessageEvent): void {
    if (!this.opts) {
      // Сообщение пришло до start() — bridge race. Редкий кейс, debug-уровня.
      if (event.origin && event.origin !== window.location.origin) {
        log.debug('message before start, origin=', event.origin)
      }
      return
    }

    const app = this.opts.resolver.resolveByOrigin(event.origin)
    if (!app) {
      // Cross-origin сообщения от чужих окон (HMR, devtools, расширения) — игнорим тихо.
      return
    }

    const msg = parseIncomingMessage(event.data)
    if (!msg) {
      log.debug('unparseable message from', app.manifest.id, event.data)
      return
    }

    log.debug(app.manifest.id, msg.kind, getMsgExtra(msg))

    // Регистрируем окно — даже если оно уже было, обновляем (iframe мог перезагрузиться).
    const origin = safeNormalizeOrigin(app.scope) ?? event.origin
    const existing = this.connections.get(app.manifest.id)
    if (event.source) {
      this.connections.set(app.manifest.id, {
        window: event.source,
        origin,
        listenerId: existing?.listenerId ?? null,
      })
    }

    this.handle(app, msg).catch((err) => {
      log.error('unhandled in dispatch', err, msg)
    })
  }

  private async handle(app: InstalledApp, msg: IncomingMessage): Promise<void> {
    switch (msg.kind) {
      case 'listener':
        this.handleListener(app, msg.message.id, msg.message.listener)
        return
      case 'rpc':
        await this.handleRpc(app, msg.message.id, msg.message.action, msg.message.data)
        return
      case 'event':
        this.opts?.onIframeEvent?.(app, msg.message.event, msg.message.data)
        return
      case 'fetch':
        await this.handleFetch(app, msg.message)
        return
    }
  }

  private handleListener(app: InstalledApp, requestId: string, listenerId: string): void {
    const conn = this.connections.get(app.manifest.id)
    if (!conn) return
    conn.listenerId = listenerId
    this.postRaw(conn, rpcSuccess(requestId, 'registered'))
    this.opts?.onListenerRegistered?.(app, listenerId)
    log.debug('listener registered', app.manifest.id, listenerId)
  }

  private async handleRpc(
    app: InstalledApp,
    requestId: string,
    action: string,
    data: unknown
  ): Promise<void> {
    if (!this.opts) return

    const ctrl = new AbortController()
    this.inflight.set(requestId, ctrl)

    const timeoutMs = this.opts.rpcTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS
    const timer = setTimeout(() => {
      ctrl.abort(new Error('rpc_timeout'))
    }, timeoutMs)

    const start = performance.now()
    try {
      const result = await this.opts.dispatchRpc({
        app,
        action,
        data,
        signal: ctrl.signal,
      })
      const conn = this.connections.get(app.manifest.id)
      if (conn) this.postRaw(conn, rpcSuccess(requestId, result))
      log.debug('rpc ok', app.manifest.id, action, `${(performance.now() - start).toFixed(1)}ms`)
    } catch (err) {
      const conn = this.connections.get(app.manifest.id)
      if (conn) this.postRaw(conn, rpcError(requestId, normalizeError(err, ctrl.signal)))
      log.debug('rpc err', app.manifest.id, action, err)
    } finally {
      clearTimeout(timer)
      this.inflight.delete(requestId)
    }
  }

  private async handleFetch(app: InstalledApp, req: FetchRequest): Promise<void> {
    if (!this.opts?.onFetchRequest) {
      // SW-туннель не сконфигурирован — отвечаем явной ошибкой
      const conn = this.connections.get(app.manifest.id)
      if (conn) {
        this.postRaw(conn, {
          type: 'FETCH_RESPONSE',
          requestId: req.requestId,
          success: false,
          error: 'fetch_tunnel_not_configured',
        })
      }
      return
    }

    try {
      const resp = await this.opts.onFetchRequest(app, req)
      const conn = this.connections.get(app.manifest.id)
      if (conn) this.postRaw(conn, resp)
    } catch (err) {
      const conn = this.connections.get(app.manifest.id)
      if (conn) {
        this.postRaw(conn, {
          type: 'FETCH_RESPONSE',
          requestId: req.requestId,
          success: false,
          error: err instanceof Error ? err.message : 'unknown error',
        })
      }
    }
  }

  private postRaw(conn: AppConnection, message: OutgoingMessage): void {
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
}

function getMsgExtra(msg: IncomingMessage): string {
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

function normalizeError(err: unknown, signal: AbortSignal): RpcError['error'] {
  if (signal.aborted) {
    return {
      message: 'rpc_timeout',
      name: 'TimeoutError',
      code: 'timeout',
    }
  }
  if (err instanceof Error) {
    return {
      message: err.message || 'unknown error',
      name: err.name,
      stack: err.stack,
    }
  }
  if (typeof err === 'string') {
    return { message: err, name: 'Error' }
  }
  return { message: 'unknown error', name: 'Error' }
}

/**
 * Глобальный singleton. Используется в `main.js`/`src.vue`.
 * Для тестов создавайте свой инстанс через `new MiniAppsBridge()`.
 */
export const miniAppsBridge = new MiniAppsBridge()
