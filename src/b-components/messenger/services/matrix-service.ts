import * as sdk from 'matrix-js-sdk'
import CryptoJS from 'crypto-js'

import type { KeyPair } from '@/blockchain/types/keys'
import { isValidAddress } from '@/blockchain/core/addresses'
import { matrixFetch } from '@/helpers/api/request'
import { Buffer } from 'buffer'
import servers from '@/servers.json'
import { addressToHex, hexToAddress } from './matrix-service/address-codec'
import { resolveMxcHttpUrl } from './matrix-service/mxc-resolver'
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
import type { MatrixClient } from './matrix-service/types'

const getDefaultMatrixBaseUrl = (): string => {
  const host = servers.servers?.production?.matrix ?? 'matrix.pocketnet.app'
  const prodUrl = host.startsWith('http') ? host : `https://${host}`
  if (!import.meta.env.DEV) return prodUrl
  // In Tauri tauriFetch isn't subject to CORS, so skip the Vite /_matrix proxy
  // and talk to the homeserver directly (which is also what's allowed by the HTTP scope).
  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  return inTauri ? prodUrl : window.location.origin
}

export class MatrixService {
  private client: any = null
  // In development we use Vite proxy (relative); in production — URL из servers.json (matrix.pocketnet.app)
  private baseUrl: string = getDefaultMatrixBaseUrl()
  private eventQueue: Array<{ event: string; listener: (...args: any[]) => void }> = []
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null
  private keepAliveIntervalMs = 60000
  private store: any = null

  /**
   * Имя БД для IndexedDBStore — отдельное на каждого matrix-юзера,
   * чтобы при смене аккаунта sync-данные не пересекались.
   */
  private getStoreDbName(userId: string): string {
    const safe = userId.replace(/[^a-zA-Z0-9_.-]/g, '_')
    return `bastyon-matrix-sync:${safe}`
  }

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

  private normalizeLoginAddress(address: string): string {
    if (!address) return address
    const trimmed = address.trim()
    const looksHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0
    if (!looksHex) return trimmed
    try {
      const decoded = Buffer.from(trimmed, 'hex').toString('utf8')
      if (decoded && isValidAddress(decoded)) return decoded
    } catch (e) {
      return trimmed
    }
    return trimmed
  }

  public async init(userId?: string, accessToken?: string, deviceId?: string) {
    if (this.client) return

    const opts: any = {
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
    if (userId && typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
      try {
        this.store = new sdk.IndexedDBStore({
          indexedDB: window.indexedDB,
          localStorage:
            typeof window.localStorage !== 'undefined' ? window.localStorage : undefined,
          dbName: this.getStoreDbName(userId),
        })
        await this.store.startup()
        opts.store = this.store
      } catch (e) {
        console.warn('[MatrixService] IndexedDBStore init failed, falling back to MemoryStore:', e)
        this.store = null
      }
    }

    this.client = sdk.createClient(opts)

    // Re-attach listeners
    this.eventQueue.forEach(({ event, listener }) => {
      this.client.on(event, listener)
    })

    if (accessToken) {
      await this.client.startClient({ initialSyncLimit: 1 })
      this.startKeepAlive()
    }
  }

  public async login(address: string, passwordOrKeyPair?: string | KeyPair, loginToken?: string) {
    try {
      const loginOpts: any = { baseUrl: this.baseUrl }
      loginOpts.fetchFn = (input: RequestInfo | URL, init?: RequestInit) => matrixFetch(input, init)

      const tempClient = sdk.createClient(loginOpts)

      const normalizedAddress = this.normalizeLoginAddress(address)

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

      let response
      if (loginToken) {
        response = await tempClient.login('m.login.token', {
          token: loginToken,
          user: userHex,
        })
      } else if (keyPair) {
        const privateKeyHex = keyPair.privateKey.toString('hex')
        const passwordHash = CryptoJS.SHA256(CryptoJS.SHA256(privateKeyHex)).toString(
          CryptoJS.enc.Hex
        )

        const loginParams: any = {
          user: userHex,
          password: passwordHash,
          initial_device_display_name: 'Bastyon Web',
        }
        try {
          response = await tempClient.login('m.login.password', loginParams)
        } catch (e) {
          response = undefined
        }

        if (!response?.access_token) {
          try {
            const available = await tempClient.isUsernameAvailable(loginParams.user)

            if (available) {
              response = await tempClient.register(loginParams.user, loginParams.password, null, {
                type: 'm.login.dummy',
              })
            }
          } catch (e) {
            response = undefined
          }
        }
      } else if (password) {
        response = await tempClient.login('m.login.password', {
          user: userHex,
          password,
        })
      }

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

  public on(event: string, listener: (...args: any[]) => void) {
    this.eventQueue.push({ event, listener })

    if (this.client) {
      this.client.on(event, listener)
    }
  }

  private async runKeepAlive() {
    if (!this.client) return

    try {
      if (typeof this.client.whoami === 'function') {
        await this.client.whoami()
        return
      }

      if (typeof this.client.getProfileInfo === 'function') {
        const userId = typeof this.client.getUserId === 'function' ? this.client.getUserId() : null

        if (userId) {
          await this.client.getProfileInfo(userId)
        }
      }
    } catch (e) {
      console.warn('Matrix keep-alive failed:', e)
    }
  }

  public startKeepAlive(intervalMs: number = this.keepAliveIntervalMs) {
    if (this.keepAliveTimer || !this.client) return

    this.keepAliveTimer = setInterval(() => {
      this.runKeepAlive()
    }, intervalMs)

    this.runKeepAlive()
  }

  public stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
  }

  public getClient() {
    return this.client
  }

  public getRooms() {
    if (!this.client) return []
    const allRooms = this.client.getRooms()

    // Return all rooms for debugging if visible is 0, or just return all to ensure we see something
    return allRooms.length > 0 ? allRooms : []
  }

  public getRoom(roomId: string) {
    if (!this.client) return null
    return this.client.getRoom(roomId)
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
        preset: 'trusted_private_chat',
        visibility: 'private',
      })

      const roomId = (res && (res.room_id || (res as any).roomId)) || null
      return typeof roomId === 'string' ? roomId : null
    } catch (e) {
      console.error('Matrix createDirectRoom failed:', e)
      return null
    }
  }

  public async sendMessage(roomId: string, content: string) {
    if (!this.client) throw new Error('Client not initialized')

    return this.client.sendEvent(roomId, 'm.room.message', {
      msgtype: 'm.text',
      body: content,
    })
  }

  /**
   * Отправить state-событие (например `m.room.encryption` с общим ключом группы).
   */
  public async sendStateEvent(roomId: string, type: string, content: any, stateKey: string) {
    if (!this.client) throw new Error('Client not initialized')
    return this.client.sendStateEvent(roomId, type, content, stateKey)
  }

  /**
   * Отправить групповое зашифрованное сообщение.
   * Соответствует формату bastyon-chat: m.room.message с msgtype "m.encrypted",
   * body = hex(AES-CBC ciphertext), hash + block — для поиска state-события общего ключа.
   */
  public async sendEncryptedTextMessage(
    roomId: string,
    payload: { body: string; hash: string; block: number }
  ) {
    if (!this.client) throw new Error('Client not initialized')
    return this.client.sendEvent(roomId, 'm.room.message', {
      msgtype: 'm.encrypted',
      body: payload.body,
      hash: payload.hash,
      block: payload.block,
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

    return this.client.sendEvent(roomId, 'm.reaction', {
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
