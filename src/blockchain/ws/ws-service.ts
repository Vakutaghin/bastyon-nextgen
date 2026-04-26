/**
 * WebSocket-сервис для реального времени.
 *
 * Подключается к прокси-серверу Pocketnet по wss://{host}:{wss},
 * авторизуется (signature + address), получает push-сообщения:
 *   - transaction: новая транзакция (с/на наш адрес)
 *   - registered: подтверждение подписки
 *   - new block: новый блок
 *
 * Аналог self.WSn в оригинальном satolist.js:20464
 */

import servers from '@/servers.json'
import type { ApiSignature } from '../types/signatures'

// --- Types ---

export interface WsMessage {
  msg?: string
  mesType?: string
  txid?: string
  addr?: string
  height?: number
  type?: string
  vin?: unknown
  vout?: unknown
  [key: string]: unknown
}

type WsEventType = 'transaction' | 'registered' | 'block' | 'message' | 'open' | 'close'
type WsHandler = (data: WsMessage) => void

// --- Reconnecting logic ---

const RECONNECT_BASE_DELAY = 2000
const RECONNECT_MAX_DELAY = 30000

// --- Service ---

class PocketnetWsService {
  private socket: WebSocket | null = null
  private handlers = new Map<WsEventType, Set<WsHandler>>()
  private connected = new Map<string, boolean>()
  private closing = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  /** Адреса, ожидающие подписки (если WS ещё не открыт) */
  private pendingSubscriptions: string[] = []

  // Public state
  isConnected = false

  // --- Event subscription ---

  on(event: WsEventType, handler: WsHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)

    return () => {
      this.handlers.get(event)?.delete(handler)
    }
  }

  private emit(event: WsEventType, data: WsMessage) {
    this.handlers.get(event)?.forEach(handler => {
      try {
        handler(data)
      } catch (e) {
        console.error(`[WS] Error in ${event} handler:`, e)
      }
    })
  }

  // --- Connection ---

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.closing = false

    const proxyList = servers.servers.production.proxy
    if (!proxyList?.length) {
      console.error('[WS] No proxy servers configured')
      return
    }

    const proxy = proxyList[0]
    if (!proxy) return
    const url = `wss://${proxy.host}:${proxy.wss}`

    console.log('[WS] Connecting to', url)

    try {
      this.socket = new WebSocket(url)
    } catch (e) {
      console.error('[WS] Failed to create WebSocket:', e)
      this.scheduleReconnect()
      return
    }

    this.socket.onopen = () => {
      console.log('[WS] Connected!')
      this.isConnected = true
      this.reconnectAttempt = 0
      this.connected.clear()
      this.emit('open', {})

      // Авторизуемся
      this.authorize()
    }

    this.socket.onmessage = (event) => {
      let data: WsMessage
      try {
        data = JSON.parse(typeof event.data === 'string' ? event.data : '{}')
      } catch {
        return
      }

      console.log('[WS] Raw message:', JSON.stringify(data).substring(0, 300))
      this.handleMessage(data)
    }

    this.socket.onclose = (event) => {
      console.log('[WS] Closed, code:', event.code, 'reason:', event.reason)
      this.isConnected = false
      this.emit('close', {})

      if (!this.closing) {
        this.scheduleReconnect()
      }
    }

    this.socket.onerror = (event) => {
      console.error('[WS] Error:', event)
    }
  }

  /**
   * Авторизуется и подписывается на текущий адрес.
   */
  private async authorize() {
    try {
      const { useAuthStore } = await import('@/blockchain/store/auth-store')
      const authStore = useAuthStore()
      const keyPair = authStore.getKeyPair
      const address = authStore.getUserAddress

      if (!keyPair || !address) {
        console.log('[WS] No keys yet, will subscribe later')
        return
      }

      await this.subscribeAddress(address, keyPair)

      // Обрабатываем отложенные подписки
      for (const pendingAddr of this.pendingSubscriptions) {
        if (pendingAddr !== address) {
          await this.subscribeAddress(pendingAddr, keyPair)
        }
      }
      this.pendingSubscriptions = []
    } catch (e) {
      console.error('[WS] Auth failed:', e)
    }
  }

  /**
   * Подписывается на транзакции для конкретного адреса.
   */
  async subscribeAddress(address: string, keyPair?: any) {
    if (this.connected.get(address)) {
      console.log('[WS] Already subscribed to', address)
      return
    }

    // Если WS ещё не открыт, откладываем подписку
    if (!this.isConnected) {
      if (!this.pendingSubscriptions.includes(address)) {
        this.pendingSubscriptions.push(address)
      }
      console.log('[WS] WS not connected yet, queued subscription for', address)
      return
    }

    if (!keyPair) {
      const { useAuthStore } = await import('@/blockchain/store/auth-store')
      const authStore = useAuthStore()
      keyPair = authStore.getKeyPair
    }

    if (!keyPair) {
      console.log('[WS] No keyPair available for subscription')
      return
    }

    let signature: ApiSignature
    try {
      const { generateApiSignature } = await import('@/blockchain/core/signatures')
      signature = generateApiSignature(keyPair, address)
    } catch (e) {
      console.error('[WS] Failed to generate signature:', e)
      return
    }

    const message = {
      signature,
      address,
      block: 0,
    }

    console.log('[WS] Subscribing to address:', address)
    this.send(JSON.stringify(message))
  }

  // --- Message handling ---

  private handleMessage(data: WsMessage) {
    // Нормализация (аналог satolist.js:23169-23185)
    if (!data.msg && !data.mesType) {
      if (data.vin && data.vout) {
        data.msg = 'transaction'
      }
    }

    if (data.msg === 'transaction' && data.mesType) {
      data.type = data.mesType
      delete data.mesType
    }

    const msgType = data.mesType || data.msg

    switch (msgType) {
      case 'registered':
        if (data.addr) {
          this.connected.set(data.addr as string, true)
          console.log('[WS] Subscribed to', data.addr, '✓')
        }
        this.emit('registered', data)
        break

      case 'transaction':
        console.log('[WS] Transaction event:', data.txid, 'addr:', data.addr)
        this.emit('transaction', data)
        break

      case 'new block':
        this.emit('block', data)
        break

      default:
        this.emit('message', data)
        break
    }
  }

  // --- Send ---

  private send(data: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(data)
    } else {
      console.warn('[WS] Cannot send — socket not open, readyState:', this.socket?.readyState)
    }
  }

  // --- Reconnect ---

  private scheduleReconnect() {
    if (this.closing) return

    this.reconnectAttempt++
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(1.5, this.reconnectAttempt - 1),
      RECONNECT_MAX_DELAY,
    )

    console.log('[WS] Reconnecting in', delay, 'ms (attempt', this.reconnectAttempt, ')')

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  // --- Lifecycle ---

  reconnect() {
    this.close()
    this.closing = false
    this.reconnectAttempt = 0
    this.connect()
  }

  close() {
    this.closing = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.onmessage = null
      this.socket.close()
      this.socket = null
    }

    this.isConnected = false
    this.connected.clear()
  }

  destroy() {
    this.close()
    this.handlers.clear()
  }
}

/** Singleton */
export const wsService = new PocketnetWsService()
