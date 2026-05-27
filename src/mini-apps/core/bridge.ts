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
 *
 * Handler-логика (rpc/fetch/listeners) живёт в bridge-rpc.ts / bridge-fetch.ts /
 * bridge-listeners.ts — здесь только wire-уровень и общий state.
 */

import { logger } from '@/services/logger'
import { parseIncomingMessage, pushEvent } from '../types/messages'
import type { IncomingMessage, Payload } from '../types/messages'
import type { InstalledApp, AppId } from '../types/app'
import { safeNormalizeOrigin } from './origin-guard'
import {
  type AppConnection,
  type BridgeOptions,
  type BridgeRouterState,
  type RpcContext,
  DEFAULT_RPC_TIMEOUT_MS,
  getMsgExtra,
  postRaw,
} from './bridge-helpers'
import { handleListener } from './bridge-listeners'
import { handleRpc } from './bridge-rpc'
import { handleFetch } from './bridge-fetch'

export type { BridgeOptions, RpcContext }
export { DEFAULT_RPC_TIMEOUT_MS }

const log = logger.scope('[mini-apps:bridge]')

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
    postRaw(conn, pushEvent(conn.listenerId, key, data))
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
    if (!this.opts) return
    const state: BridgeRouterState = {
      connections: this.connections,
      inflight: this.inflight,
      opts: this.opts,
      postRaw,
    }
    switch (msg.kind) {
      case 'listener':
        handleListener(state, app, msg.message.id, msg.message.listener)
        return
      case 'rpc':
        await handleRpc(state, app, msg.message.id, msg.message.action, msg.message.data)
        return
      case 'event':
        this.opts.onIframeEvent?.(app, msg.message.event, msg.message.data)
        return
      case 'fetch':
        await handleFetch(state, app, msg.message)
        return
    }
  }
}

/**
 * Глобальный singleton. Используется в `main.js`/`src.vue`.
 * Для тестов создавайте свой инстанс через `new MiniAppsBridge()`.
 */
export const miniAppsBridge = new MiniAppsBridge()
