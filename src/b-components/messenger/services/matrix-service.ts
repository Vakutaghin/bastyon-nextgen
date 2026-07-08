import * as sdk from 'matrix-js-sdk'

import type { KeyPair } from '@/blockchain/types/keys'
import { matrixFetch } from '@/helpers/api/request'
import { addressToHex, hexToAddress } from './matrix-service/address-codec'
import { resolveMxcHttpUrl } from './matrix-service/mxc-resolver'
import { normalizeLoginAddress, performMatrixLogin } from './matrix-service/auth'
import { getDefaultMatrixBaseUrl, createIndexedDbStore } from './matrix-service/transport'
import { runKeepAlive } from './matrix-service/keepalive'
import {
  uploadContent as uploadContentImpl,
  sendAudio as sendAudioImpl,
  sendImage as sendImageImpl,
  sendVideo as sendVideoImpl,
  sendFile as sendFileImpl,
  sendPkoinTransaction as sendPkoinTransactionImpl,
  type SendAudioData,
  type SendImageData,
  type SendVideoData,
  type SendFileData,
  type SendPkoinPayload,
} from './matrix-service/media-sender'
import type { MatrixClient, MatrixEventContent } from './matrix-service/types'
import type { MatrixClient as SdkMatrixClient, ICreateClientOpts } from 'matrix-js-sdk'
import { Preset, Visibility } from 'matrix-js-sdk'

export class MatrixService {
  private client: SdkMatrixClient | null = null
  // In development we use Vite proxy (relative); in production — URL из servers.json (matrix.pocketnet.app)
  private baseUrl: string = getDefaultMatrixBaseUrl()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- event-bus прокидывает произвольные аргументы matrix-событий (room, event, state…); потребители подписываются с конкретными сигнатурами, поэтому листенер обязан быть bivariant `any[]`
  private eventQueue: Array<{ event: string; listener: (...args: any[]) => void }> = []
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null
  private keepAliveIntervalMs = 60000
  private store: InstanceType<typeof sdk.IndexedDBStore> | null = null

  public configure(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  public getBaseUrl() {
    return this.baseUrl
  }

  /** Pocketnet address → hex. Реализация — `matrix-service/address-codec`. */
  public addressToHex(str: string): string {
    return addressToHex(str)
  }

  /** Hex → Pocketnet address. Реализация — `matrix-service/address-codec`. */
  public hexToAddress(hex: string): string {
    return hexToAddress(hex)
  }

  public async init(userId?: string, accessToken?: string, deviceId?: string) {
    if (this.client) return

    const opts: ICreateClientOpts = {
      baseUrl: this.baseUrl,
      timelineSupport: true,
    }

    if (userId && accessToken) {
      opts.userId = userId
      opts.accessToken = accessToken
      if (deviceId) opts.deviceId = deviceId
    }

    // Все запросы Matrix (в т.ч. /filter) через matrixFetch — в Tauri обход CORS
    opts.fetchFn = (input: RequestInfo | URL, init?: RequestInit) => matrixFetch(input, init)

    // Включаем IndexedDBStore: matrix-js-sdk сохраняет sync-state на диск,
    // и при последующих запусках `getRooms()` сразу возвращает все комнаты из кэша,
    // без полного initial sync с сервера. Это самый дешёвый и крупный буст к скорости
    // первого отображения списка диалогов.
    if (userId) {
      this.store = await createIndexedDbStore(userId)
      if (this.store) opts.store = this.store
    }

    const client = sdk.createClient(opts)
    this.client = client

    // Re-attach listeners. Событие — динамическая строка из нашего fluent-API `on()`,
    // приводим к типу события SDK (а не к any).
    this.eventQueue.forEach(({ event, listener }) => {
      client.on(event as Parameters<SdkMatrixClient['on']>[0], listener)
    })

    if (accessToken) {
      await this.client.startClient({ initialSyncLimit: 1 })
      this.startKeepAlive()
    }
  }

  public async login(address: string, passwordOrKeyPair?: string | KeyPair, loginToken?: string) {
    try {
      const loginOpts: ICreateClientOpts = { baseUrl: this.baseUrl }
      loginOpts.fetchFn = (input: RequestInfo | URL, init?: RequestInit) => matrixFetch(input, init)

      const tempClient = sdk.createClient(loginOpts)

      const normalizedAddress = normalizeLoginAddress(address)

      let password = ''
      let keyPair: KeyPair | null = null
      if (typeof passwordOrKeyPair === 'string') {
        password = passwordOrKeyPair
      } else if (
        passwordOrKeyPair &&
        typeof passwordOrKeyPair === 'object' &&
        'privateKey' in passwordOrKeyPair
      ) {
        keyPair = passwordOrKeyPair
      }

      const userHex = this.addressToHex(normalizedAddress).toLowerCase()

      const response = await performMatrixLogin(tempClient, {
        userHex,
        password,
        keyPair,
        loginToken,
      })

      if (response && response.access_token) {
        if (this.client) {
          this.client.stopClient()
          this.client = null
        }

        await this.init(response.user_id, response.access_token, response.device_id)
        return true
      }

      return false
    } catch (e) {
      console.error('Matrix login failed:', e)
      return false
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- см. eventQueue: листенер event-bus принимает произвольные сигнатуры matrix-событий
  public on(event: string, listener: (...args: any[]) => void) {
    this.eventQueue.push({ event, listener })

    if (this.client) {
      this.client.on(event as Parameters<SdkMatrixClient['on']>[0], listener)
    }
  }

  /**
   * Отправляет typing-нотификацию в комнату. `timeout` для isTyping=true — окно,
   * в течение которого индикатор активен у собеседника (сбрасываем досрочно при отправке).
   */
  public async sendTyping(roomId: string, isTyping: boolean, timeout = 4000): Promise<void> {
    if (!this.client || !roomId) return
    try {
      await this.client.sendTyping(roomId, isTyping, isTyping ? timeout : 0)
    } catch (e) {
      // Typing — не критично; не шумим в UI.
      console.debug('[matrix] sendTyping failed', e)
    }
  }

  public startKeepAlive(intervalMs: number = this.keepAliveIntervalMs) {
    if (this.keepAliveTimer || !this.client) return

    this.keepAliveTimer = setInterval(() => {
      runKeepAlive(this.client)
    }, intervalMs)

    runKeepAlive(this.client)
  }

  public stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- клиент matrix потребляется duck-typing'ом в десятке мест сторов (paginateEventTimeline/setRoomReadMarkers/mxcUrlToHttp/...); строгий SDK-тип потянул бы рефактор всех потребителей и здесь вне границ задачи
  public getClient(): any {
    return this.client
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- результат Room потребляется duck-typing'ом в десятке мест сторов (room.timeline/currentState/...); строгий matrix `Room` потянул бы рефактор всех потребителей и здесь вне границ задачи
  public getRooms(): any[] {
    if (!this.client) return []
    const allRooms = this.client.getRooms()

    // Return all rooms for debugging if visible is 0, or just return all to ensure we see something
    return allRooms.length > 0 ? allRooms : []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- см. getRooms: Room потребляется duck-typing'ом, строгий тип вне границ задачи
  public getRoom(roomId: string): any {
    if (!this.client) return null
    return this.client.getRoom(roomId)
  }

  /**
   * Вступает в комнату, если у текущего пользователя по ней висит приглашение
   * (membership === 'invite'). Без join'а Matrix запрещает отправку
   * (M_FORBIDDEN: «not in room») — частый кейс, когда чат создал собеседник, а
   * нас лишь пригласили. Идемпотентно: для уже joined-комнат ничего не делает.
   */
  public async joinIfInvited(roomId: string): Promise<void> {
    if (!this.client || !roomId) return
    try {
      const room = this.client.getRoom?.(roomId)
      const membership = room?.getMyMembership?.()
      if (membership !== 'invite') return
      await this.client.joinRoom?.(roomId)
    } catch (e) {
      console.warn('[matrix] joinIfInvited failed:', e)
    }
  }

  /**
   * Создаёт личный чат (запрос _matrix/client/v3/createRoom), как в старом bastyon-chat.
   * Комната появляется в списке чатов после синка; в store добавляется оптимистичный диалог сразу.
   */
  public async createDirectRoom(inviteeId: string): Promise<string | null> {
    if (!this.client) throw new Error('Client not initialized')

    try {
      const res = await this.client.createRoom({
        invite: [inviteeId],
        is_direct: true,
        preset: Preset.TrustedPrivateChat,
        visibility: Visibility.Private,
      })

      const roomId = (res && (res.room_id || (res as { roomId?: string }).roomId)) || null
      return typeof roomId === 'string' ? roomId : null
    } catch (e) {
      console.error('Matrix createDirectRoom failed:', e)
      return null
    }
  }

  public async sendMessage(
    roomId: string,
    content: string,
    extraContent?: Record<string, unknown>
  ) {
    if (!this.client) throw new Error('Client not initialized')

    return (this.client as MatrixClient).sendEvent(roomId, 'm.room.message', {
      msgtype: 'm.text',
      body: content,
      // extraContent — relation-метаданные (m.relates_to / m.new_content) для
      // ответа/редактирования. См. use-message-sending (reply/edit).
      ...extraContent,
    })
  }

  /**
   * Redact (удалить) событие — удаление своего сообщения.
   * @param reason — опциональная причина (в content m.room.redaction).
   */
  public async redactEvent(roomId: string, eventId: string, reason?: string) {
    if (!this.client) throw new Error('Client not initialized')
    return (this.client as MatrixClient).redactEvent(
      roomId,
      eventId,
      undefined,
      reason ? { reason } : undefined
    )
  }

  /**
   * Отправить state-событие (например `m.room.encryption` с общим ключом группы).
   */
  public async sendStateEvent(
    roomId: string,
    type: string,
    content: MatrixEventContent,
    stateKey: string
  ) {
    if (!this.client) throw new Error('Client not initialized')
    return (this.client as MatrixClient).sendStateEvent(roomId, type, content, stateKey)
  }

  /**
   * Отправить групповое зашифрованное сообщение.
   * Соответствует формату bastyon-chat: m.room.message с msgtype "m.encrypted",
   * body = hex(AES-CBC ciphertext), hash + block — для поиска state-события общего ключа.
   */
  public async sendEncryptedTextMessage(
    roomId: string,
    payload: { body: string; hash: string; block: number },
    extraContent?: Record<string, unknown>
  ) {
    if (!this.client) throw new Error('Client not initialized')
    return (this.client as MatrixClient).sendEvent(roomId, 'm.room.message', {
      msgtype: 'm.encrypted',
      body: payload.body,
      hash: payload.hash,
      block: payload.block,
      // extraContent — relation-метаданные (m.relates_to / m.new_content).
      ...extraContent,
    })
  }

  /**
   * Отправить личное (1:1) зашифрованное текстовое сообщение (E2E).
   * Формат — как forta.chat / bastyon-chat `encryptEvent` для tetatet: m.room.message
   * с msgtype 'm.encrypted', body = Base64(JSON per-user AES-SIV map), block +
   * version на верхнем уровне content (БЕЗ `hash` — это признак группового пути).
   * Приёмный путь (`tryDecrypt`) распознаёт такой body по base64-эвристике и
   * расшифровывает через `pcrypto.decryptEvent`.
   */
  public async sendEncryptedDirectMessage(
    roomId: string,
    payload: { body: string; block: number; version: number },
    extraContent?: Record<string, unknown>
  ) {
    if (!this.client) throw new Error('Client not initialized')
    return (this.client as MatrixClient).sendEvent(roomId, 'm.room.message', {
      msgtype: 'm.encrypted',
      body: payload.body,
      block: payload.block,
      version: payload.version,
      // extraContent — relation-метаданные (m.relates_to) для ответа. Лежат на
      // внешнем (открытом) content, как и у группового зашифрованного сообщения.
      ...extraContent,
    })
  }

  public async uploadContent(
    file: Blob | File,
    opts?: {
      name?: string
      type?: string
      onProgress?: (loaded: number, total?: number) => void
    }
  ): Promise<string> {
    if (!this.client) throw new Error('Client not initialized')
    return uploadContentImpl(this.client as MatrixClient, file, opts)
  }

  /**
   * Отправить реакцию на сообщение (m.reaction с m.annotation).
   * @param roomId — ID комнаты
   * @param eventId — ID события (сообщения), на которое ставим реакцию
   * @param key — эмодзи или текст реакции (например "👍", "❤️")
   */
  public async sendReaction(roomId: string, eventId: string, key: string) {
    if (!this.client) throw new Error('Client not initialized')

    return (this.client as MatrixClient).sendEvent(roomId, 'm.reaction', {
      'm.relates_to': {
        event_id: eventId,
        key,
        rel_type: 'm.annotation',
      },
    })
  }

  /** Реализации медиа-отправки вынесены в `matrix-service/media-sender`. */
  public async sendAudio(
    roomId: string,
    data: SendAudioData,
    onProgress?: (loaded: number, total?: number) => void
  ) {
    if (!this.client) throw new Error('Client not initialized')
    return sendAudioImpl(this.client as MatrixClient, roomId, data, onProgress)
  }

  public async sendImage(
    roomId: string,
    data: SendImageData,
    onProgress?: (loaded: number, total?: number) => void
  ) {
    if (!this.client) throw new Error('Client not initialized')
    return sendImageImpl(this.client as MatrixClient, roomId, data, onProgress)
  }

  public async sendVideo(
    roomId: string,
    data: SendVideoData,
    onProgress?: (loaded: number, total?: number) => void
  ) {
    if (!this.client) throw new Error('Client not initialized')
    return sendVideoImpl(this.client as MatrixClient, roomId, data, onProgress)
  }

  public async sendFile(
    roomId: string,
    data: SendFileData,
    onProgress?: (loaded: number, total?: number) => void
  ) {
    if (!this.client) throw new Error('Client not initialized')
    return sendFileImpl(this.client as MatrixClient, roomId, data, onProgress)
  }

  /**
   * Отправляет PKOIN-донат как Matrix-сообщение.
   * msgtype: 'm.text' с extra-полем `pocketnet_transaction` — наш клиент
   * рендерит карточку, сторонние видят body (читаемое описание).
   */
  public async sendPkoinTransaction(roomId: string, payload: SendPkoinPayload) {
    if (!this.client) throw new Error('Client not initialized')
    return sendPkoinTransactionImpl(this.client as MatrixClient, roomId, payload)
  }

  /** Преобразует mxc:// в публичный HTTPS-URL. См. `matrix-service/mxc-resolver`. */
  public mxcToHttp(mxcUrl: string): string | null {
    return resolveMxcHttpUrl(this.client as MatrixClient | null, mxcUrl)
  }

  /**
   * Покинуть комнату (leave) и забыть её (forget).
   * После forget комната удаляется из локального хранилища SDK.
   */
  public async leaveAndForgetRoom(roomId: string): Promise<void> {
    if (!this.client) throw new Error('Client not initialized')

    await this.client.leave(roomId)
    await this.client.forget(roomId, true)
  }

  public stop() {
    if (this.client) {
      this.client.stopClient()
      this.client = null
    }
    if (this.store) {
      try {
        this.store.destroy?.()
      } catch {
        /* ignore */
      }
      this.store = null
    }
    this.stopKeepAlive()
    this.eventQueue = []
  }
}

export const matrixService = new MatrixService()
