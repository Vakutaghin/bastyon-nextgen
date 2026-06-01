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
import type { KeyPair } from '../types/keys'
import { pickWebSocketCtor } from '@/helpers/tor/tor-websocket'
import { debugLog } from '@/helpers/common/debug-log'

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
const CONNECT_TIMEOUT_MS = 10000

// --- Service ---

class PocketnetWsService {
  private socket: WebSocket | null = null
  private handlers = new Map<WsEventType, Set<WsHandler>>()
  private connected = new Map<string, boolean>()
  private closing = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  /** Адреса, ожидающие подписки (если WS ещё не открыт) */
  private pendingSubscriptions: string[] = []
  /** Адреса, для которых SUBSCRIBE-сообщение уже в полёте — защита от гонок */
  private subscribingAddresses = new Set<string>()

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
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(data)
      } catch (e) {
        console.error(`[WS] Error in ${event} handler:`, e)
      }
    })
  }

  // --- Connection ---

  async connect() {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
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

    debugLog('[WS] Connecting to', url)

    try {
      const Ctor = await pickWebSocketCtor()
      this.socket = new Ctor(url)
    } catch (e) {
      console.error('[WS] Failed to create WebSocket:', e)
      this.scheduleReconnect()
      return
    }

    // Таймаут на установление соединения: зависший SYN иначе держал бы сокет вечно.
    this.clearConnectTimer()
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null
      if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
        console.error('[WS] Connect timeout, forcing reconnect')
        try {
          this.socket.close()
        } catch {
          /* noop */
        }
        if (!this.closing) this.scheduleReconnect()
      }
    }, CONNECT_TIMEOUT_MS)

    this.socket.onopen = () => {
      debugLog('[WS] Connected!')
      this.clearConnectTimer()
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

      debugLog('[WS] Raw message:', JSON.stringify(data).substring(0, 300))
      this.handleMessage(data)
    }

    this.socket.onclose = (event) => {
      debugLog('[WS] Closed, code:', event.code, 'reason:', event.reason)
      this.clearConnectTimer()
      this.isConnected = false
      this.emit('close', {})

      if (!this.closing) {
        this.scheduleReconnect()
      }
    }

    this.socket.onerror = (event) => {
      console.error('[WS] Error:', event)
      // Без этого сокет остаётся в зомби-состоянии (onclose не всегда срабатывает).
      // Закрываем явно — onclose штатно зашедулит reconnect; scheduleReconnect идемпотентен.
      if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
        try {
          this.socket.close()
        } catch {
          /* noop */
        }
      }
      if (!this.closing) this.scheduleReconnect()
    }
  }

  private clearConnectTimer() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
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
        debugLog('[WS] No keys yet, will subscribe later')
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
  async subscribeAddress(address: string, keyPair?: KeyPair | null) {
    if (this.connected.get(address)) {
      debugLog('[WS] Already subscribed to', address)
      return
    }
    // Race-guard: одновременный двойной вызов раньше проходил эту проверку до того,
    // как connected.set отрабатывал по ответу сервера.
    if (this.subscribingAddresses.has(address)) {
      debugLog('[WS] Subscription already in flight for', address)
      return
    }

    this.subscribingAddresses.add(address)
    try {
      // Если WS ещё не открыт, откладываем подписку
      if (!this.isConnected) {
        if (!this.pendingSubscriptions.includes(address)) {
          this.pendingSubscriptions.push(address)
        }
        debugLog('[WS] WS not connected yet, queued subscription for', address)
        return
      }

      if (!keyPair) {
        const { useAuthStore } = await import('@/blockchain/store/auth-store')
        const authStore = useAuthStore()
        keyPair = authStore.getKeyPair
      }

      if (!keyPair) {
        debugLog('[WS] No keyPair available for subscription')
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

      debugLog('[WS] Subscribing to address:', address)
      this.send(JSON.stringify(message))
    } finally {
      this.subscribingAddresses.delete(address)
    }
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
          debugLog('[WS] Subscribed to', data.addr, '✓')
        }
        this.emit('registered', data)
        break

      case 'transaction':
        debugLog('[WS] Transaction event:', data.txid, 'addr:', data.addr)
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
    // Idempotent: onerror + onclose из-за одной аварии иначе зашедулили бы два reconnect-а подряд.
    if (this.reconnectTimer) return

    this.reconnectAttempt++
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(1.5, this.reconnectAttempt - 1),
      RECONNECT_MAX_DELAY
    )

    debugLog('[WS] Reconnecting in', delay, 'ms (attempt', this.reconnectAttempt, ')')

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, delay)
  }

  // --- Lifecycle ---

  reconnect() {
    this.close() // сбрасывает reconnectAttempt
    this.closing = false
    void this.connect()
  }

  close() {
    this.closing = true
    // Сбрасываем backoff: следующий цикл connect() начнётся с чистого счётчика,
    // а не залипнет на RECONNECT_MAX_DELAY от прошлой неудачной серии.
    this.reconnectAttempt = 0

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.clearConnectTimer()
    this.subscribingAddresses.clear()

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
