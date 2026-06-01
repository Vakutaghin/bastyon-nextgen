import * as miscreant from 'miscreant'
// @ts-expect-error — pbkdf2 не поставляет .d.ts типов
import pbkdf2 from 'pbkdf2'
// @ts-expect-error — bn.js типы не подключены в проекте
import BN from 'bn.js'
import * as ecc from 'tiny-secp256k1'
import { Buffer } from 'buffer'
import CryptoJS from 'crypto-js'

const salt = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const secp256k1CurveN = new BN(
  'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
  16
)
const m = 12

export interface User {
  id: string
  keys: string[] // Array of hex strings (public keys)
  dbId?: number // Database ID (integer) for consistent sorting in key derivation
}

export interface UserPrivate {
  private: string // Hex string
  public: string // Hex string
}

/** Зашифрованный пакет ключей внутри секрета: либо строка, либо {encrypted, nonce}. */
interface EncryptedKeyPacket {
  encrypted?: string
  nonce?: string
}

/** Контейнер секретов внутри content.info / content.pbody. */
interface SecretsContainer {
  keys?: string
  block?: number
  version?: number
  v?: number
}

/**
 * Минимальная структура matrix-события (raw или fake), которую читает decryptEvent.
 * Описывает только поля, к которым обращается метод.
 */
export interface DecryptableEvent {
  type?: string
  sender?: string
  content?: {
    hash?: string
    version?: number
    keys?: string
    body?: string
    block?: number
    info?: { secrets?: SecretsContainer }
    pbody?: { secrets?: SecretsContainer }
  }
}

const f = {
  sha224: (str: string) => CryptoJS.SHA224(str).toString(CryptoJS.enc.Hex),

  _base64ToArrayBuffer: (base64: string) => {
    const binary_string = atob(base64)
    const len = binary_string.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i)
    }
    return bytes.buffer
  },

  _arrayBufferToBase64: (buffer: ArrayBuffer) => {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]!)
    }
    return btoa(binary)
  },
}

export class PcryptoService {
  private userPrivate: UserPrivate[]
  private myId: string

  constructor(userPrivate: UserPrivate[], myId: string) {
    this.userPrivate = userPrivate
    this.myId = myId
  }

  // eaa implementation
  private eaa = {
    cuhash: (users: User[], num: number, block: number) => {
      // Bastyon-chat logic:
      // _.map(users, u => u.keys[num]).join("") + (block || currentHeight)
      // SHA224 -> Hex -> PBKDF2(..., salt, 1, 32, "sha256")

      const input = users.map((u) => u.keys[num]).join('') + block

      return pbkdf2.pbkdf2Sync(f.sha224(input), salt, 1, 32, 'sha256')
    },

    scalars: (block: number, privates: string[], users: User[]) => {
      let sum: BN | null = null

      for (let i = 0; i < m; i++) {
        // Convert buffer to hex string for BN to avoid interpretation issues
        const hashBuffer = Buffer.from(this.eaa.cuhash(users, i, block))
        const ch = new BN(hashBuffer.toString('hex'), 16)

        let privateKey = privates[i]
        // Handle case where privateKey is Buffer/Uint8Array instead of hex string
        if (typeof privateKey !== 'string') {
          try {
            // @ts-expect-error — privateKey здесь Buffer|Uint8Array, тип сужен runtime-проверкой
            privateKey = Buffer.from(privateKey).toString('hex')
          } catch (e) {
            console.error('[Pcrypto] Failed to convert private key to hex', privateKey)
          }
        }

        const a = new BN(privateKey, 16)
        const mul = a.mul(ch).umod(secp256k1CurveN)

        if (!sum) {
          sum = mul
        } else {
          sum = sum.add(mul).umod(secp256k1CurveN)
        }
      }

      return sum!
    },

    points: (block: number, points: Uint8Array[], users: User[]) => {
      let sum: Uint8Array | null = null

      for (let i = 0; i < m; i++) {
        const ch = this.eaa.cuhash(users, i, block)

        // bitcoin.ecc.pointMultiply(points[i], ch, undefined, true)
        const mul = ecc.pointMultiply(points[i]!, ch, true)

        if (!mul) throw new Error('Point multiplication failed')

        if (!sum) {
          sum = mul
        } else {
          // bitcoin.ecc.pointAdd(sum, mul, undefined, true)
          sum = ecc.pointAdd(sum, mul, true)
        }
      }

      return sum!
    },

    current: (block: number, users: User[]) => {
      const privates = this.userPrivate.map((k) => k.private)
      const sc = this.eaa.scalars(block, privates, users).toBuffer()

      // Ensure 32 bytes padding
      const target = Buffer.alloc(32)
      sc.copy(target, 32 - sc.length)

      return target
    },

    userspublics: (block: number, users: User[]) => {
      const sum: Record<string, Uint8Array> = {}
      const myId = this.getmatrixid(this.myId)

      users.forEach((user) => {
        if (!user.keys || user.keys.length < m) return
        const userId = this.getmatrixid(user.id)
        if (userId === myId && users.length > 1) return

        const publics = user.keys.map((key) => Buffer.from(key, 'hex'))
        sum[userId] = this.eaa.points(block, publics, users)
      })

      return sum
    },

    aeskeys: (block: number, users: User[]) => {
      const us = this.eaa.userspublics(block, users)
      const c = this.eaa.current(block, users)
      const su: Record<string, Buffer> = {}

      Object.keys(us).forEach((id) => {
        const point = us[id]!
        const shared = ecc.pointMultiply(point, c, true)
        if (shared) {
          su[id] = pbkdf2.pbkdf2Sync(Buffer.from(shared).toString('hex'), salt, 64, 32, 'sha512')
        }
      })

      return su
    },
  }

  public async decryptSIVRaw(
    keyData: Uint8Array,
    encrypted: Uint8Array,
    ad: Uint8Array | Uint8Array[]
  ): Promise<Uint8Array> {
    // @ts-expect-error — miscreant.SIV.importKey: типы не описывают полную сигнатуру
    const key = await miscreant.SIV.importKey(keyData, 'AES-SIV')
    // @ts-expect-error — key.open принимает Uint8Array|Uint8Array[] (ad), типы miscreant узкие
    return await key.open(encrypted, ad)
  }

  private async decryptSIV(keyData: Uint8Array, encrypted: string, nonce: string = '') {
    const _encrypted = new Uint8Array(f._base64ToArrayBuffer(encrypted))
    const _nonce = new Uint8Array(f._base64ToArrayBuffer(nonce))
    const k = await this.decryptSIVRaw(keyData, _encrypted, _nonce)
    return new TextDecoder().decode(k)
  }

  public async encryptSIVRaw(
    keyData: Uint8Array,
    plaintext: Uint8Array,
    ad: Uint8Array | Uint8Array[]
  ): Promise<Uint8Array> {
    // @ts-expect-error — miscreant.SIV.importKey: типы не описывают полную сигнатуру
    const key = await miscreant.SIV.importKey(keyData, 'AES-SIV')
    // @ts-expect-error — key.seal принимает Uint8Array|Uint8Array[] (ad), типы miscreant узкие
    return await key.seal(plaintext, ad)
  }

  private async encryptSIV(keyData: Uint8Array, plaintext: string) {
    const enc = new TextEncoder()
    const data = enc.encode(plaintext)
    const nonce = crypto.getRandomValues(new Uint8Array(16))
    const sealed = await this.encryptSIVRaw(keyData, data, nonce)
    const encrypted = f._arrayBufferToBase64(sealed.buffer as ArrayBuffer)
    const n = f._arrayBufferToBase64(nonce.buffer as ArrayBuffer)
    return { encrypted, nonce: n }
  }

  // Helper matching bastyon-chat/src/application/functions.js getmatrixid
  private getmatrixid(str: string | undefined): string {
    return str?.split(':')[0]?.replace('@', '') || ''
  }

  // Helper to mimic bastyon-chat's orderedIdsHash logic (numeric sort)
  private getNumericId(id: string): number {
    return Number(id.replace(/[^0-9]/g, ''))
  }

  public async decryptEvent(event: DecryptableEvent, users: User[]) {
    // Групповое m.room.message с hash идёт через отдельный путь decryptGroupMessage в chat-store.
    // А вот state-событие m.room.encryption (которое содержит общий ключ) тоже имеет hash —
    // его необходимо обработать здесь.
    if (event?.content?.hash && event?.type !== 'm.room.encryption') {
      return null
    }

    let secrets = ''
    let block = 0
    let version = event?.content?.version

    if (event?.content?.info?.secrets) {
      secrets = event.content.info.secrets.keys || ''
      block = event.content.info.secrets.block || 0
      if (!version) {
        version = event.content.info.secrets.version || event.content.info.secrets.v
      }
    } else if (event?.content?.pbody?.secrets) {
      secrets = event.content.pbody.secrets.keys || ''
      block = event.content.pbody.secrets.block || 0
      if (!version) {
        version = event.content.pbody.secrets.version || event.content.pbody.secrets.v
      }
    } else if (event?.type === 'm.room.encryption') {
      secrets = event.content?.keys || ''
      block = event.content?.block || 0
    } else {
      if (event?.content?.keys) secrets = event.content.keys
      else if (event?.content?.body) secrets = event.content.body
      if (event?.content?.block) block = event.content.block
    }

    if (!secrets) {
      return null
    }

    if (!block) {
      block = 10
    }

    const sender = this.getmatrixid(event.sender)
    const me = this.getmatrixid(this.myId)

    let body: Record<string, EncryptedKeyPacket | string>
    try {
      const bytes = new Uint8Array(f._base64ToArrayBuffer(secrets))
      const decodedStr = new TextDecoder().decode(bytes)
      body = JSON.parse(decodedStr)
    } catch (e) {
      return null
    }

    let keyindex = ''
    let bodyindex = ''

    if (sender === me) {
      for (const i of Object.keys(body)) {
        if (i !== me) {
          keyindex = i
          bodyindex = i
          break
        }
      }
    } else {
      bodyindex = me
      keyindex = sender
    }

    if (!bodyindex || !body[bodyindex]) {
      throw new Error('emptyforme')
    }

    const userIds = Array.from(new Set([...Object.keys(body), sender]))
    const usersByBody = users.filter((u) => {
      const id = this.getmatrixid(u.id)
      return userIds.includes(id)
    })
    const preparedUsers = usersByBody
      .filter((u) => u.keys && u.keys.length >= m)
      .sort((a, b) => {
        if (!version || version <= 1) return 0
        const dbIdA = a.dbId || 0
        const dbIdB = b.dbId || 0
        return dbIdA - dbIdB
      })

    const keys = this.eaa.aeskeys(block, preparedUsers)

    if (!keys[keyindex]) {
      const matched = Object.keys(keys).find((k) => k.includes(keyindex) || keyindex.includes(k))
      if (matched) keyindex = matched
    }

    if (!keys[keyindex]) {
      throw new Error('emptykey')
    }

    const encryptedKeyData = body[bodyindex]!
    const encrypted =
      typeof encryptedKeyData === 'string'
        ? encryptedKeyData
        : encryptedKeyData.encrypted || ''
    const nonce = typeof encryptedKeyData === 'string' ? '' : encryptedKeyData.nonce || ''

    return await this.decryptSIV(keys[keyindex]!, encrypted, nonce)
  }

  public async encryptKey(secret: string, users: User[], block: number, version: number) {
    const prepared = users
      .filter((u) => u.keys && u.keys.length >= m)
      .sort((a, b) => {
        if (!version || version <= 1) return 0
        const dbIdA = a.dbId || 0
        const dbIdB = b.dbId || 0
        return dbIdA - dbIdB
      })
    const keys = this.eaa.aeskeys(block, prepared)
    const body: Record<string, { encrypted: string; nonce: string }> = {}
    const me = this.getmatrixid(this.myId)
    for (const u of prepared) {
      const id = this.getmatrixid(u.id)
      if (id === me && prepared.length > 1) continue
      const k = keys[id]
      if (!k) continue
      const r = await this.encryptSIV(k, secret)
      body[id] = r
    }
    const keysBase64 = f._arrayBufferToBase64(
      new TextEncoder().encode(JSON.stringify(body)).buffer as ArrayBuffer
    )
    return { block, keys: keysBase64, v: version }
  }
}
