/**
 * Сокет уведомлений к ноде напрямую (`wss://IP:8887/ws`) — только текст, как
 * нужно ws-service. Как и запросы, идёт мимо WebView (самоподписанный
 * сертификат): в десктопе — Rust (`node_ws_*`, события `node:ws:<id>:*`), на
 * Android — плагин NodeLink (события `wsMessage`, `wsClose`). Сертификат WSS у
 * ноды свой, не тот, что у API, — запоминается отдельно.
 */

import { Capacitor } from '@capacitor/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { generateWsId } from '@/helpers/tor/tor-websocket'
import { isTauriEnv } from '../request-tor'
import { NodeLink } from './native-link'
import { pinOf, rememberPin } from './node-pins'

const CONNECTING = 0
const OPEN = 1
const CLOSING = 2
const CLOSED = 3

/** На Android события плагина общие — раздаём их сокетам по id. */
const androidSockets = new Map<string, NodeWebSocket>()
let androidListening: Promise<void> | null = null

function listenAndroid(): Promise<void> {
  androidListening ??= Promise.all([
    NodeLink.addListener('wsMessage', (e) => androidSockets.get(e.id)?._message(e.data)),
    NodeLink.addListener('wsClose', (e) =>
      androidSockets.get(e.id)?._serverClose(e.code ?? 1006, e.reason ?? '')
    ),
  ]).then(() => undefined)
  return androidListening
}

type Handler<E> = ((event: E) => unknown) | null

export class NodeWebSocket {
  static readonly CONNECTING = CONNECTING
  static readonly OPEN = OPEN
  static readonly CLOSING = CLOSING
  static readonly CLOSED = CLOSED

  readonly url: string
  onopen: Handler<Event> = null
  onmessage: Handler<{ data: string }> = null
  onclose: Handler<{ code: number; reason: string }> = null
  onerror: Handler<{ message: string }> = null

  private state: 0 | 1 | 2 | 3 = CONNECTING
  private readonly id = generateWsId()
  private readonly endpoint: string
  private unlisten: UnlistenFn[] = []
  private nativeOpen = false

  constructor(host: string, port: number) {
    this.url = `wss://${host}:${port}/ws`
    this.endpoint = `${host}:${port}`
    this.connect().catch((e: unknown) => this.fail(e))
  }

  get readyState(): number {
    return this.state
  }

  send(data: string): void {
    if (this.state !== OPEN) return
    const id = this.id
    const sent = isTauriEnv()
      ? import('@tauri-apps/api/core').then(({ invoke }) => invoke('node_ws_send', { id, data }))
      : NodeLink.wsSend({ id, data })
    sent.catch((e: unknown) => this.onerror?.({ message: String(e) }))
  }

  close(): void {
    if (this.state === CLOSING || this.state === CLOSED) return
    this.state = CLOSING
    if (this.nativeOpen) void this.closeNative()
    this._serverClose(1000, '')
  }

  private async connect(): Promise<void> {
    const id = this.id
    const pin = pinOf(this.endpoint)
    let fingerprint: string
    if (isTauriEnv()) {
      const { invoke } = await import('@tauri-apps/api/core')
      const { listen } = await import('@tauri-apps/api/event')
      // Подписки до connect: Tauri не копит события.
      this.unlisten.push(
        await listen<{ data: string }>(`node:ws:${id}:message`, (e) =>
          this._message(e.payload.data)
        ),
        await listen<{ code?: number | null; reason?: string | null }>(`node:ws:${id}:close`, (e) =>
          this._serverClose(e.payload?.code ?? 1006, e.payload?.reason ?? '')
        ),
        await listen<{ error: string }>(`node:ws:${id}:error`, (e) =>
          this.onerror?.({ message: e.payload?.error ?? 'unknown' })
        )
      )
      if (this.state !== CONNECTING) return this.cleanup()
      fingerprint = (
        await invoke<{ fingerprint: string }>('node_ws_connect', { id, url: this.url, pin })
      ).fingerprint
    } else if (Capacitor.isNativePlatform()) {
      await listenAndroid()
      androidSockets.set(id, this)
      fingerprint = (await NodeLink.wsConnect({ id, url: this.url, pin })).fingerprint
    } else {
      throw new Error('direct node connection is not available here')
    }
    this.nativeOpen = true
    rememberPin(this.endpoint, fingerprint)
    if (this.state !== CONNECTING) {
      // close() успел раньше открытия — нативный сокет уже есть.
      await this.closeNative()
      return
    }
    this.state = OPEN
    this.onopen?.(new Event('open'))
  }

  /** @internal */
  _message(data: string): void {
    if (this.state === OPEN) this.onmessage?.({ data })
  }

  /** @internal Сервер закрыл сокет или он оборвался. */
  _serverClose(code: number, reason: string): void {
    if (this.state === CLOSED) return
    this.state = CLOSED
    this.nativeOpen = false
    this.cleanup()
    this.onclose?.({ code, reason })
  }

  private fail(error: unknown): void {
    if (this.state === CLOSED) return
    this.onerror?.({ message: error instanceof Error ? error.message : String(error) })
    this._serverClose(1006, 'connect failed')
  }

  private async closeNative(): Promise<void> {
    this.nativeOpen = false
    const id = this.id
    try {
      if (isTauriEnv()) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('node_ws_close', { id })
      } else {
        await NodeLink.wsClose({ id })
      }
    } catch {
      // сокета уже нет
    }
  }

  private cleanup(): void {
    for (const u of this.unlisten) {
      try {
        u()
      } catch {
        // уже отписан
      }
    }
    this.unlisten = []
    androidSockets.delete(this.id)
  }
}
