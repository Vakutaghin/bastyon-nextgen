/**
 * Drop-in replacement for the standard WebSocket that pipes the connection
 * through the Tauri/Rust SOCKS5 tunnel into Tor.
 *
 * Behaviour mirrors the WebSocket DOM interface closely enough that libraries
 * (e.g. matrix-js-sdk, simple-ws clients) can use it as a transport.
 *
 * Протокол с Rust (V22): id соединения генерирует JS и подписывается на
 * `tor:ws:<id>:*` ДО `tor_ws_connect`; успешный invoke = OPEN. Раньше Rust
 * эмитил `open` синхронно до возврата id, JS подписывался после — событие
 * терялось, и под Tor сокет никогда не открывался.
 *
 * Notes:
 * - `bufferedAmount` is approximated and updates only when send completes.
 * - `protocol` and `extensions` are not negotiated through the shim yet
 *   (tor_ws_connect currently ignores Sec-WebSocket-Protocol). If a consumer
 *   requires sub-protocols, extend the Rust side to forward them.
 */

import type { UnlistenFn } from '@tauri-apps/api/event'

import { TorNotReadyError, waitForTorRouting } from './tor-gate'

/** Сколько сокет ждёт готовности Tor до отказа (ws-service сам закрывает через 10 с). */
export const TOR_WS_WAIT_TIMEOUT_MS = 60_000

/** id попадает в имена событий: только [A-Za-z0-9-] (Rust валидирует так же). */
export function generateWsId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

const CONNECTING = 0
const OPEN = 1
const CLOSING = 2
const CLOSED = 3

type BinaryType = 'blob' | 'arraybuffer'

type IncomingMessage = { kind: 'text'; data: string } | { kind: 'binary'; data_b64: string }

export class TorWebSocket extends EventTarget implements WebSocket {
  static readonly CONNECTING = CONNECTING
  static readonly OPEN = OPEN
  static readonly CLOSING = CLOSING
  static readonly CLOSED = CLOSED

  readonly CONNECTING = CONNECTING
  readonly OPEN = OPEN
  readonly CLOSING = CLOSING
  readonly CLOSED = CLOSED

  readonly url: string
  readonly protocol = ''
  readonly extensions = ''

  binaryType: BinaryType = 'blob'

  private _readyState: 0 | 1 | 2 | 3 = CONNECTING
  private _bufferedAmount = 0
  private readonly _id: string = generateWsId()
  /** Rust держит сокет с момента успешного `tor_ws_connect` до `tor_ws_close`. */
  private _rustOpen = false
  private _closeSent = false
  private _unlisteners: UnlistenFn[] = []
  private _pendingSends: Array<() => void> = []

  // on* — аксессоры на прототипе, а не поля экземпляра: обработчик вызывается
  // ровно один раз из _onOpen/_onMessage/…; поле-свойство happy-dom вызывал бы
  // ещё раз сам при dispatchEvent (как IDL-атрибут), браузер — нет.
  private _handlers: {
    open: ((this: WebSocket, ev: Event) => unknown) | null
    message: ((this: WebSocket, ev: MessageEvent) => unknown) | null
    error: ((this: WebSocket, ev: Event) => unknown) | null
    close: ((this: WebSocket, ev: CloseEvent) => unknown) | null
  } = { open: null, message: null, error: null, close: null }

  get onopen(): ((this: WebSocket, ev: Event) => unknown) | null {
    return this._handlers.open
  }
  set onopen(fn: ((this: WebSocket, ev: Event) => unknown) | null) {
    this._handlers.open = fn
  }
  get onmessage(): ((this: WebSocket, ev: MessageEvent) => unknown) | null {
    return this._handlers.message
  }
  set onmessage(fn: ((this: WebSocket, ev: MessageEvent) => unknown) | null) {
    this._handlers.message = fn
  }
  get onerror(): ((this: WebSocket, ev: Event) => unknown) | null {
    return this._handlers.error
  }
  set onerror(fn: ((this: WebSocket, ev: Event) => unknown) | null) {
    this._handlers.error = fn
  }
  get onclose(): ((this: WebSocket, ev: CloseEvent) => unknown) | null {
    return this._handlers.close
  }
  set onclose(fn: ((this: WebSocket, ev: CloseEvent) => unknown) | null) {
    this._handlers.close = fn
  }

  constructor(url: string | URL, _protocols?: string | string[]) {
    super()
    this.url = typeof url === 'string' ? url : url.toString()
    this._init().catch((err) => this._fail(err))
  }

  get readyState(): number {
    return this._readyState
  }

  get bufferedAmount(): number {
    return this._bufferedAmount
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this._readyState === CONNECTING) {
      throw new DOMException(
        "Failed to execute 'send' on 'WebSocket': Still in CONNECTING state.",
        'InvalidStateError'
      )
    }
    if (this._readyState !== OPEN) return

    const id = this._id

    const send = async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const payload = await this._encodeOutgoing(data)
      this._bufferedAmount += payload.size
      try {
        await invoke('tor_ws_send', { id, payload: payload.frame })
      } catch (e) {
        this._dispatchError(String(e))
      } finally {
        this._bufferedAmount -= payload.size
      }
    }
    this._pendingSends.push(() => void send())
    this._drain()
  }

  close(code?: number, reason?: string): void {
    if (this._readyState === CLOSING || this._readyState === CLOSED) return
    this._readyState = CLOSING
    if (!this._rustOpen) {
      // Ещё CONNECTING: как в браузере — сразу CLOSED (1006). Если invoke в
      // полёте, `_init` после него увидит не-CONNECTING и закроет Rust-сторону
      // сам — иначе оставался зомби-сокет (S3).
      this._onClose(1006, 'closed before open')
      return
    }
    void this._closeRust(code ?? 1000, reason ?? '').then(() =>
      this._onClose(code ?? 1000, reason ?? '')
    )
  }

  // ------------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------------

  private async _init(): Promise<void> {
    // Fail-closed (V20): при включённом, но не готовом Tor ждём, а не
    // открываем нативный сокет с адресом и подписью мимо Tor.
    const mode = await waitForTorRouting({ timeoutMs: TOR_WS_WAIT_TIMEOUT_MS })
    if (this._readyState !== CONNECTING) return
    if (mode !== 'tor') {
      throw new TorNotReadyError(mode === 'failed' ? 'failed' : 'off')
    }

    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    const id = this._id

    // Подписки ДО invoke: Tauri не буферизует события (V22).
    this._unlisteners.push(
      await listen<IncomingMessage>(`tor:ws:${id}:message`, (e) => this._onMessage(e.payload)),
      await listen<{ code?: number | null; reason?: string | null }>(`tor:ws:${id}:close`, (e) =>
        this._onServerClose(e.payload?.code ?? 1006, e.payload?.reason ?? '')
      ),
      await listen<{ error: string }>(`tor:ws:${id}:error`, (e) =>
        this._dispatchError(e.payload?.error ?? 'unknown')
      )
    )
    if (this._readyState !== CONNECTING) {
      this._cleanupListeners()
      return
    }

    await invoke('tor_ws_connect', { id, url: this.url })
    this._rustOpen = true

    if (this._readyState !== CONNECTING) {
      // close() успел раньше — Rust уже держит сокет (S3).
      this._cleanupListeners()
      await this._closeRust(1000, '')
      return
    }
    this._onOpen()
  }

  private async _closeRust(code: number, reason: string): Promise<void> {
    if (this._closeSent) return
    this._closeSent = true
    const id = this._id
    const { invoke } = await import('@tauri-apps/api/core')
    try {
      await invoke('tor_ws_send', { id, payload: { kind: 'close', code, reason } })
    } catch {
      /* best-effort */
    }
    try {
      await invoke('tor_ws_close', { id })
    } catch {
      /* best-effort */
    }
  }

  private _onOpen(): void {
    if (this._readyState !== CONNECTING) return
    this._readyState = OPEN
    const ev = new Event('open')
    this.dispatchEvent(ev)
    this.onopen?.call(this as unknown as WebSocket, ev)
    this._drain()
  }

  /** Close/ошибка со стороны сервера: Rust уже убрал сокет из карты (S60). */
  private _onServerClose(code: number, reason: string): void {
    this._rustOpen = false
    this._closeSent = true
    this._onClose(code, reason)
  }

  private _onMessage(payload: IncomingMessage): void {
    if (this._readyState !== OPEN) return
    let data: string | ArrayBuffer | Blob
    if (payload.kind === 'text') {
      data = payload.data
    } else {
      const bytes = base64ToBytes(payload.data_b64)
      if (this.binaryType === 'arraybuffer') {
        const ab = new ArrayBuffer(bytes.byteLength)
        new Uint8Array(ab).set(bytes)
        data = ab
      } else {
        data = new Blob([bytes as unknown as BlobPart])
      }
    }
    const ev = new MessageEvent('message', { data })
    this.dispatchEvent(ev)
    this.onmessage?.call(this as unknown as WebSocket, ev)
  }

  private _onClose(code: number, reason: string): void {
    if (this._readyState === CLOSED) return
    this._readyState = CLOSED
    this._cleanupListeners()
    const ev = new CloseEvent('close', { code, reason, wasClean: code === 1000 })
    this.dispatchEvent(ev)
    this.onclose?.call(this as unknown as WebSocket, ev)
  }

  private _dispatchError(message: string): void {
    const ev = new Event('error')
    ;(ev as Event & { message: string }).message = message
    this.dispatchEvent(ev)
    this.onerror?.call(this as unknown as WebSocket, ev)
  }

  private _fail(err: unknown): void {
    if (this._readyState === CLOSED) return
    this._dispatchError(err instanceof Error ? err.message : String(err))
    if (this._rustOpen) void this._closeRust(1006, 'connect failed')
    this._onClose(1006, 'connect failed')
  }

  private _drain(): void {
    if (this._readyState !== OPEN) return
    const queue = this._pendingSends.splice(0, this._pendingSends.length)
    for (const fn of queue) fn()
  }

  private _cleanupListeners(): void {
    for (const u of this._unlisteners) {
      try {
        u()
      } catch {
        /* best-effort */
      }
    }
    this._unlisteners = []
  }

  private async _encodeOutgoing(
    data: string | ArrayBufferLike | Blob | ArrayBufferView
  ): Promise<{ frame: object; size: number }> {
    if (typeof data === 'string') {
      return {
        frame: { kind: 'text', data },
        size: new Blob([data]).size,
      }
    }
    let bytes: Uint8Array
    if (data instanceof Blob) {
      bytes = new Uint8Array(await data.arrayBuffer())
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data)
    } else if (ArrayBuffer.isView(data)) {
      bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    } else {
      bytes = new Uint8Array(data as ArrayBufferLike)
    }
    return {
      frame: { kind: 'binary', data_b64: bytesToBase64(bytes) },
      size: bytes.byteLength,
    }
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[])
  }
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Конструктор для новых соединений: `TorWebSocket`, когда Tor включён в
 * десктопе (даже если ещё бутстрапится — сокет дождётся готовности), иначе
 * нативный. Раньше при `enabled && !ready` уходил нативный сокет (V20).
 */
export async function pickWebSocketCtor(): Promise<typeof WebSocket> {
  try {
    const { useTorStore } = await import('@/stores/tor-store')
    const store = useTorStore()
    if (store.wantsTor) {
      return TorWebSocket as unknown as typeof WebSocket
    }
  } catch {
    /* best-effort */
  }
  return WebSocket
}
