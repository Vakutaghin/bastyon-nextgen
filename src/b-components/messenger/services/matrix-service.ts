import * as sdk from 'matrix-js-sdk'
import CryptoJS from 'crypto-js'

import type { KeyPair } from '@/blockchain/types/keys'
import { isValidAddress } from '@/blockchain/core/addresses'
import { Buffer } from 'buffer'
import servers from '@/servers.json'

const getDefaultMatrixBaseUrl = (): string => {
  if (import.meta.env.DEV) return window.location.origin
  const host = servers.servers?.production?.matrix ?? 'matrix.pocketnet.app'
  return host.startsWith('http') ? host : `https://${host}`
}

export class MatrixService {
  private client: any = null
  // In development we use Vite proxy (relative); in production — URL из servers.json (matrix.pocketnet.app)
  private baseUrl: string = getDefaultMatrixBaseUrl()
  private eventQueue: Array<{ event: string, listener: (...args: any[]) => void }> = []
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null
  private keepAliveIntervalMs = 60000

  public configure(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  public getBaseUrl() {
    return this.baseUrl
  }

  /**
   * Convert Pocketnet address to Hex string (matching Legacy App behavior)
   */
  public addressToHex(str: string): string {
    let result = ''
    for (let i = 0; i < str.length; i++) {
      let ch = str.charCodeAt(i)
      if (ch > 0xff) ch -= 0x350
      const hex = ch.toString(16)
      result += (hex.length < 2 ? '0' : '') + hex
    }
    return result
  }

  /**
   * Convert Hex string to Pocketnet address (matching Legacy App behavior)
   */
  public hexToAddress(hex: string): string {
    let result = ''
    for (let i = 0; i < hex.length; i += 2) {
      const chHex = hex.substring(i, i + 2)
      // Check if valid hex
      if (!/^[0-9a-fA-F]{2}$/.test(chHex)) {
          return ''
      }
      let charCode = parseInt(chHex, 16)
      // Restore Cyrillic characters if applicable (mapping from addressToHex)
      if (charCode >= 0x80) { // Extended ASCII range
          charCode += 0x350
      }
      result += String.fromCharCode(charCode)
    }
    return result
  }

  private getAuthHost(): string {
    try {
      const host = new URL(this.baseUrl).host || window.location.host
      if (host.includes('localhost') || host.startsWith('127.0.0.1')) {
        return 'matrix.pocketnet.app'
      }
      return host
    } catch (e) {
      return window.location.host
    }
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
      const tempClient = sdk.createClient({ baseUrl: this.baseUrl })

      const normalizedAddress = this.normalizeLoginAddress(address)

      let password = ''
      let keyPair: KeyPair | null = null
      if (typeof passwordOrKeyPair === 'string') {
        password = passwordOrKeyPair
      } else if (passwordOrKeyPair && typeof passwordOrKeyPair === 'object' && 'privateKey' in passwordOrKeyPair) {
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
        const passwordHash = CryptoJS.SHA256(CryptoJS.SHA256(privateKeyHex)).toString(CryptoJS.enc.Hex)
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
              response = await tempClient.register(loginParams.user, loginParams.password, null, { type: 'm.login.dummy' })
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
        visibility: 'private'
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

  public async uploadContent(
    file: Blob | File,
    opts?: {
      name?: string
      type?: string
      onProgress?: (loaded: number, total?: number) => void
    }
  ): Promise<string> {
    if (!this.client) throw new Error('Client not initialized')

    const progressCb = opts?.onProgress
      ? (info: { loaded: number; total?: number }) => {
          try {
            opts?.onProgress?.(info.loaded, info.total)
          } catch (_e) {}
        }
      : undefined

    const res = await this.client.uploadContent(file, {
      name: opts?.name,
      type: opts?.type || (file as any)?.type,
      progressCallback: progressCb,
    })
    // matrix-js-sdk may return a string (mxc://...) or an object { content_uri: 'mxc://...' }
    const uri = typeof res === 'string' ? res : (res && typeof res === 'object' && (res as any).content_uri)
    if (!uri || typeof uri !== 'string') {
      throw new Error('Upload content failed: invalid response')
    }
    return uri
  }

  public async sendAudio(
    roomId: string,
    data: {
      blob?: Blob
      mxcUrl?: string
      name?: string
      mimetype?: string
      duration?: number
      size?: number
      secrets?: { keys: string; block: number; v?: number; version?: number }
      block?: number
    },
    onProgress?: (loaded: number, total?: number) => void
  ) {
    if (!this.client) throw new Error('Client not initialized')

    let mxcUrl = data.mxcUrl
    let mimetype = data.mimetype
    let size = data.size

    if (!mxcUrl && data.blob) {
      mimetype = mimetype || (data.blob as any).type || 'audio/webm'
      size = size || data.blob.size
      mxcUrl = await this.uploadContent(data.blob, {
        name: data.name || 'voice-message',
        type: mimetype,
        onProgress,
      })
    }

    if (!mxcUrl) {
      throw new Error('sendAudio failed: missing mxcUrl')
    }

    let httpUrl: string | null = null
    try {
      if (typeof this.client.mxcUrlToHttp === 'function' && mxcUrl) {
        const candidate = this.client.mxcUrlToHttp(mxcUrl)
        const isLoopback = typeof candidate === 'string' && (candidate.includes('://127.0.0.1') || candidate.includes('://localhost'))
        if (!isLoopback) {
          httpUrl = candidate
        }
      }
    } catch (_e) {}

    if (!httpUrl && typeof mxcUrl === 'string' && mxcUrl.startsWith('mxc://')) {
      try {
        const t = mxcUrl.replace('mxc://', '').split('/')
        const server = t[0]
        const mediaId = t[1]
        if (server && mediaId) {
          httpUrl = `https://${server}/_matrix/media/v3/download/${server}/${mediaId}`
        }
      } catch (_e) {}
    }

    const bodyName = httpUrl || data.name || 'voice-message'
    const info: any = {
      mimetype: mimetype || 'audio/webm',
      size: size || 0,
    }
    if (typeof data.duration === 'number') {
      info.duration = Math.round(data.duration * 1000) // ms per spec
    }
    // Fallback: duplicate URL inside info for clients that read it from info.url
    info.url = mxcUrl
    if (httpUrl) info.httpUrl = httpUrl
    if (data.secrets) info.secrets = data.secrets

    const content: any = {
      msgtype: 'm.audio',
      body: bodyName,
      url: httpUrl || mxcUrl,
      info,
    }
    if (typeof data.block === 'number') content.block = data.block
    if (data.secrets?.v) content.version = data.secrets.v
    return this.client.sendEvent(roomId, 'm.room.message', content)
  }

  public stop() {
    if (this.client) {
      this.client.stopClient()
      this.client = null
    }
    this.stopKeepAlive()
    this.eventQueue = []
  }
}

export const matrixService = new MatrixService()
