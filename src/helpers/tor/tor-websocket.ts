/**
 * Drop-in replacement for the standard WebSocket that pipes the connection
 * through the Tauri/Rust SOCKS5 tunnel into Tor.
 *
 * Behaviour mirrors the WebSocket DOM interface closely enough that libraries
 * (e.g. matrix-js-sdk, simple-ws clients) can use it as a transport.
 *
 * Notes:
 * - `bufferedAmount` is approximated and updates only when send completes.
 * - `protocol` and `extensions` are not negotiated through the shim yet
 *   (tor_ws_connect currently ignores Sec-WebSocket-Protocol). If a consumer
 *   requires sub-protocols, extend the Rust side to forward them.
 */

import type { UnlistenFn } from '@tauri-apps/api/event'

const CONNECTING = 0
const OPEN = 1
const CLOSING = 2
const CLOSED = 3

type BinaryType = 'blob' | 'arraybuffer'

type IncomingMessage =
  | { kind: 'text'; data: string }
  | { kind: 'binary'; data_b64: string }

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
  private _id: string | null = null
  private _unlisteners: UnlistenFn[] = []
  private _pendingSends: Array<() => void> = []

  onopen: ((this: WebSocket, ev: Event) => unknown) | null = null
  onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null
  onerror: ((this: WebSocket, ev: Event) => unknown) | null = null
  onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null

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
    if (!id) return

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
    const id = this._id
    if (!id) return
    void (async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      try {
        await invoke('tor_ws_send', {
          id,
          payload: { kind: 'close', code: code ?? null, reason: reason ?? null },
        })
      } catch {}
      try {
        await invoke('tor_ws_close', { id })
      } catch {}
    })()
  }

  // ------------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------------

  private async _init(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    const id = await invoke<string>('tor_ws_connect', { url: this.url })
    this._id = id

    const eventOpen = `tor:ws:${id}:open`
    const eventMsg = `tor:ws:${id}:message`
    const eventClose = `tor:ws:${id}:close`
    const eventErr = `tor:ws:${id}:error`

    this._unlisteners.push(
      await listen<unknown>(eventOpen, () => this._onOpen()),
      await listen<IncomingMessage>(eventMsg, (e) => this._onMessage(e.payload)),
      await listen<{ code?: number | null; reason?: string | null }>(
        eventClose,
        (e) => this._onClose(e.payload?.code ?? 1000, e.payload?.reason ?? '')
      ),
      await listen<{ error: string }>(eventErr, (e) =>
        this._dispatchError(e.payload?.error ?? 'unknown')
      )
    )
  }

  private _onOpen(): void {
    this._readyState = OPEN
    const ev = new Event('open')
    this.dispatchEvent(ev)
    this.onopen?.call(this as unknown as WebSocket, ev)
    this._drain()
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
    this._dispatchError(err instanceof Error ? err.message : String(err))
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
      } catch {}
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

/**
 * Returns the WebSocket constructor that should be used for new connections:
 * `TorWebSocket` if Tor is enabled and ready, otherwise the native one.
 */
export async function pickWebSocketCtor(): Promise<typeof WebSocket> {
  try {
    const { useTorStore } = await import('@/stores/tor-store')
    const store = useTorStore()
    if (store.shouldTorify) {
      return TorWebSocket as unknown as typeof WebSocket
    }
  } catch {}
  return WebSocket
}

let _patched = false

/**
 * Optionally swap `globalThis.WebSocket` for our shim while Tor is active.
 * Call once at app startup if you want libraries that capture the global at
 * import-time to pick up the change.
 */
export function installTorWebSocketGlobalGuard(): void {
  if (_patched) return
  _patched = true
  const Native = globalThis.WebSocket
  const Shim = TorWebSocket as unknown as typeof WebSocket
  // Proxy that decides per-construction.
  const Hybrid = function (
    this: unknown,
    url: string | URL,
    protocols?: string | string[]
  ) {
    try {
      // Synchronous access; the store is in memory after pinia install.
      const mod = (globalThis as typeof globalThis & {
        __torStoreSync?: { shouldTorify: boolean }
      }).__torStoreSync
      if (mod?.shouldTorify) {
        return new Shim(url, protocols)
      }
    } catch {}
    return new Native(url, protocols)
  } as unknown as typeof WebSocket
  Object.defineProperty(Hybrid, 'name', { value: 'WebSocket' })
  const statics = Hybrid as unknown as {
    CONNECTING: number
    OPEN: number
    CLOSING: number
    CLOSED: number
  }
  statics.CONNECTING = CONNECTING
  statics.OPEN = OPEN
  statics.CLOSING = CLOSING
  statics.CLOSED = CLOSED
  globalThis.WebSocket = Hybrid
}
