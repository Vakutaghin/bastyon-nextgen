/**
 * Поддельное companion-радио MeshCore для тестов и стенда — по поведению
 * прошивки (examples/companion_radio/MyMesh.cpp, src/helpers/BaseChatMesh.cpp):
 * те же кадры байт в байт, тот же ACK (SHA-256 от времени, попытки, текста и
 * ключа отправителя), та же очередь в RAM на 16 сообщений, то же правило
 * «ЛС от узла не из контактов не расшифровать».
 *
 * Радио общаются через `FakeAir`: в нём можно терять пакеты и ACK, чтобы
 * проверить повторы и поздние подтверждения.
 *
 * Только для тестов: в приложение не импортируется.
 */

import { ByteReader, concat, fromHex, fromUtf8z, toHex, u16le, u32le, utf8 } from '../../bytes'
import type { CloseReason, Unsubscribe } from '../../radio/types'
import {
  ADV_TYPE,
  CHANNEL_SECRET_SIZE,
  CMD,
  ERR_CODE,
  MAX_PATH_SIZE,
  MAX_TEXT_LEN,
  NAME_FIELD_SIZE,
  OUT_PATH_UNKNOWN,
  PUB_KEY_SIZE,
  PUSH,
  RESP,
  TXT_TYPE,
} from '../constants'
import type { FrameLink } from '../framing'

export interface FakeContact {
  publicKey: string
  type: number
  flags: number
  outPathLen: number
  name: string
  lastAdvert: number
  lat: number
  lon: number
  lastMod: number
}

export interface FakeChannel {
  name: string
  /** 16 байт hex; нули — пустой слот. */
  secret: string
}

const OFFLINE_QUEUE_SIZE = 16
const FIRMWARE_VER_CODE = 13

async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
  const data = concat(...parts)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data.slice().buffer))
}

/** ACK личного сообщения: sha256(время, флаги, текст, ключ отправителя)[0..4]. */
export async function expectedAck(
  timestamp: number,
  attempt: number,
  text: string,
  senderKeyHex: string
): Promise<string> {
  const hash = await sha256(
    u32le(timestamp),
    new Uint8Array([attempt & 3]),
    utf8(text),
    fromHex(senderKeyHex)
  )
  return toHex(hash.slice(0, 4))
}

function fixed(text: string, size: number): Uint8Array {
  const out = new Uint8Array(size)
  out.set(utf8(text).slice(0, size - 1))
  return out
}

function i32(v: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setInt32(0, v | 0, true)
  return out
}

function randomKey(): string {
  const b = new Uint8Array(PUB_KEY_SIZE)
  crypto.getRandomValues(b)
  return toHex(b)
}

export class FakeAir {
  readonly radios = new Set<FakeCompanion>()
  /** Потерять столько следующих личных сообщений (ни доставки, ни ACK). */
  dropMessages = 0
  /** Потерять столько следующих ACK (сообщение дошло, ответ — нет). */
  dropAcks = 0
  /** Задержка ACK, мс. */
  ackDelayMs = 0

  join(radio: FakeCompanion): void {
    this.radios.add(radio)
  }

  byPrefix(prefix: string, except: FakeCompanion): FakeCompanion | null {
    for (const r of this.radios) if (r !== except && r.publicKey.startsWith(prefix)) return r
    return null
  }
}

export interface FakeCompanionOptions {
  name: string
  publicKey?: string
  maxContacts?: number
  maxChannels?: number
  /** Добавлять объявившиеся узлы в контакты сами (как по умолчанию в прошивке). */
  autoAdd?: boolean
  /** Часы радио, секунды. */
  time?: number
  channels?: FakeChannel[]
}

export class FakeCompanion {
  readonly publicKey: string
  name: string
  contacts: FakeContact[] = []
  channels: FakeChannel[]
  readonly offlineQueue: Uint8Array[] = []
  appName = ''
  appVersion = 0
  time: number
  batteryMv = 4012
  readonly maxContacts: number
  readonly maxChannels: number
  autoAdd: boolean
  /** Все кадры команд, пришедшие от приложения. */
  readonly received: Uint8Array[] = []
  private readonly toApp = new Set<(frame: Uint8Array) => void>()
  private readonly closeCbs = new Set<(r: CloseReason) => void>()
  private readonly expected = new Map<string, number>()
  private connected = false
  private queueCmds: Promise<void> = Promise.resolve()

  constructor(
    private readonly air: FakeAir | null,
    options: FakeCompanionOptions
  ) {
    this.publicKey = (options.publicKey ?? randomKey()).toLowerCase()
    this.name = options.name
    this.maxContacts = options.maxContacts ?? 100
    this.maxChannels = options.maxChannels ?? 8
    this.autoAdd = options.autoAdd ?? true
    this.time = options.time ?? 1_750_000_000
    const zero = '0'.repeat(CHANNEL_SECRET_SIZE * 2)
    this.channels = Array.from({ length: this.maxChannels }, (_, i) =>
      options.channels?.[i] ? { ...options.channels[i]! } : { name: '', secret: zero }
    )
    air?.join(this)
  }

  // ─── Сторона приложения ───────────────────────────────────────────────────

  /** Соединение, как его видит протокол (кадры без обрамления). */
  connect(kind: FrameLink['kind'] = 'tcp', label = 'fake'): FrameLink {
    this.connected = true
    return {
      kind,
      label,
      send: async (frame) => {
        if (!this.connected) throw new Error('link_not_found: closed')
        this.received.push(frame.slice())
        // Команды по одной, как у прошивки (один буфер кадра).
        this.queueCmds = this.queueCmds.then(() => this.handleCommand(frame))
      },
      onFrame: (cb) => {
        this.toApp.add(cb)
        return () => this.toApp.delete(cb)
      },
      onClose: (cb) => {
        this.closeCbs.add(cb)
        return () => this.closeCbs.delete(cb)
      },
      close: async () => {
        this.connected = false
        this.toApp.clear()
        this.closeCbs.clear()
      },
    }
  }

  /** Устройство пропало (кабель выдернули). */
  drop(reason = 'device_lost: unplugged'): void {
    this.connected = false
    const cbs = [...this.closeCbs]
    this.toApp.clear()
    this.closeCbs.clear()
    for (const cb of cbs) cb(reason)
  }

  get isConnected(): boolean {
    return this.connected
  }

  /** Подписка на кадры для приложения — для стенда поверх TCP. */
  onFrameToApp(cb: (frame: Uint8Array) => void): Unsubscribe {
    this.toApp.add(cb)
    return () => this.toApp.delete(cb)
  }

  /** Принять кадр команды — для стенда поверх TCP. */
  receiveCommand(frame: Uint8Array): Promise<void> {
    this.received.push(frame.slice())
    this.queueCmds = this.queueCmds.then(() => this.handleCommand(frame))
    return this.queueCmds
  }

  private write(frame: Uint8Array): void {
    // Как настоящее радио: ответ приходит асинхронно.
    const cbs = [...this.toApp]
    setTimeout(() => {
      for (const cb of cbs) cb(frame)
    }, 0)
  }

  private ok(): void {
    this.write(new Uint8Array([RESP.OK]))
  }

  private err(code: number): void {
    this.write(new Uint8Array([RESP.ERR, code]))
  }

  // ─── Команды (MyMesh::handleCmdFrame) ─────────────────────────────────────

  private async handleCommand(frame: Uint8Array): Promise<void> {
    const r = new ByteReader(frame)
    const cmd = r.u8()
    const len = frame.length
    switch (cmd) {
      case CMD.DEVICE_QUERY: {
        if (len < 2) return this.err(ERR_CODE.UNSUPPORTED_CMD)
        this.appVersion = r.u8()
        this.write(
          concat(
            new Uint8Array([
              RESP.DEVICE_INFO,
              FIRMWARE_VER_CODE,
              this.maxContacts / 2,
              this.maxChannels,
            ]),
            u32le(123456),
            fixed('20-Sep-2026', 12),
            fixed('Heltec V3', 40),
            fixed('v1.17.1', 20),
            new Uint8Array([0, 0])
          )
        )
        return
      }
      case CMD.APP_START: {
        if (len < 8) return this.err(ERR_CODE.UNSUPPORTED_CMD)
        r.skip(7)
        this.appName = new TextDecoder().decode(r.rest())
        this.write(this.selfInfo())
        return
      }
      case CMD.SEND_TXT_MSG: {
        if (len < 14) return this.err(ERR_CODE.UNSUPPORTED_CMD)
        const txtType = r.u8()
        const attempt = r.u8()
        const ts = r.u32()
        const prefix = toHex(r.bytesN(6))
        const text = new TextDecoder().decode(r.rest())
        const recipient = this.contacts.find((c) => c.publicKey.startsWith(prefix))
        if (!recipient) return this.err(ERR_CODE.NOT_FOUND)
        if (txtType !== TXT_TYPE.PLAIN) return this.err(ERR_CODE.UNSUPPORTED_CMD)
        if (utf8(text).length > MAX_TEXT_LEN) return this.err(ERR_CODE.TABLE_FULL)
        const flood = recipient.outPathLen === OUT_PATH_UNKNOWN
        const ack = await expectedAck(ts, attempt, text, this.publicKey)
        this.expected.set(ack, Date.now())
        this.write(
          concat(
            new Uint8Array([RESP.SENT, flood ? 1 : 0]),
            fromHex(ack),
            u32le(flood ? 8000 : 3000)
          )
        )
        void this.transmitDirect(recipient, ts, attempt, text, flood)
        return
      }
      case CMD.SEND_CHANNEL_TXT_MSG: {
        const txtType = r.u8()
        const index = r.u8()
        const ts = r.u32()
        const text = new TextDecoder().decode(r.rest())
        if (txtType !== TXT_TYPE.PLAIN) return this.err(ERR_CODE.UNSUPPORTED_CMD)
        const channel = this.channels[index]
        if (!channel || /^0+$/.test(channel.secret)) return this.err(ERR_CODE.NOT_FOUND)
        // BaseChatMesh::sendGroupMessage: «имя: текст», длиннее 160 байт — обрезка.
        const prefix = `${this.name}: `
        let full = prefix + text
        while (utf8(full).length > MAX_TEXT_LEN) full = full.slice(0, -1)
        this.ok()
        this.broadcastChannel(channel.secret, ts, full)
        return
      }
      case CMD.GET_CONTACTS: {
        const since = len >= 5 ? r.u32() : 0
        this.write(concat(new Uint8Array([RESP.CONTACTS_START]), u32le(this.contacts.length)))
        let mostRecent = 0
        for (const c of this.contacts) {
          if (c.lastMod > since) {
            this.write(this.contactFrame(RESP.CONTACT, c))
            mostRecent = Math.max(mostRecent, c.lastMod)
          }
        }
        this.write(concat(new Uint8Array([RESP.END_OF_CONTACTS]), u32le(mostRecent)))
        return
      }
      case CMD.GET_CONTACT_BY_KEY: {
        const key = toHex(r.bytesN(PUB_KEY_SIZE))
        const c = this.contacts.find((x) => x.publicKey === key)
        if (!c) return this.err(ERR_CODE.NOT_FOUND)
        this.write(this.contactFrame(RESP.CONTACT, c))
        return
      }
      case CMD.SET_ADVERT_NAME: {
        this.name = new TextDecoder().decode(r.rest()).slice(0, NAME_FIELD_SIZE - 1)
        this.ok()
        return
      }
      case CMD.GET_DEVICE_TIME:
        this.write(concat(new Uint8Array([RESP.CURR_TIME]), u32le(this.time)))
        return
      case CMD.SET_DEVICE_TIME: {
        const secs = r.u32()
        if (secs >= this.time) {
          this.time = secs
          this.ok()
        } else {
          this.err(ERR_CODE.ILLEGAL_ARG)
        }
        return
      }
      case CMD.SEND_SELF_ADVERT:
        this.ok()
        this.broadcastAdvert()
        return
      case CMD.RESET_PATH: {
        const key = toHex(r.bytesN(PUB_KEY_SIZE))
        const c = this.contacts.find((x) => x.publicKey === key)
        if (!c) return this.err(ERR_CODE.NOT_FOUND)
        c.outPathLen = OUT_PATH_UNKNOWN
        this.ok()
        return
      }
      case CMD.ADD_UPDATE_CONTACT: {
        const c = decodeFakeContact(frame)
        const existing = this.contacts.find((x) => x.publicKey === c.publicKey)
        if (existing) Object.assign(existing, c)
        else if (this.contacts.length >= this.maxContacts) return this.err(ERR_CODE.TABLE_FULL)
        else this.contacts.push(c)
        this.ok()
        return
      }
      case CMD.REMOVE_CONTACT: {
        const key = toHex(r.bytesN(PUB_KEY_SIZE))
        const i = this.contacts.findIndex((x) => x.publicKey === key)
        if (i === -1) return this.err(ERR_CODE.NOT_FOUND)
        this.contacts.splice(i, 1)
        this.ok()
        return
      }
      case CMD.SYNC_NEXT_MESSAGE: {
        const next = this.offlineQueue.shift()
        this.write(next ?? new Uint8Array([RESP.NO_MORE_MESSAGES]))
        return
      }
      case CMD.GET_BATT_AND_STORAGE:
        this.write(
          concat(
            new Uint8Array([RESP.BATT_AND_STORAGE]),
            u16le(this.batteryMv),
            u32le(12),
            u32le(256)
          )
        )
        return
      case CMD.GET_CHANNEL: {
        const index = r.u8()
        const c = this.channels[index]
        if (!c) return this.err(ERR_CODE.NOT_FOUND)
        this.write(
          concat(
            new Uint8Array([RESP.CHANNEL_INFO, index]),
            fixed(c.name, NAME_FIELD_SIZE),
            fromHex(c.secret)
          )
        )
        return
      }
      case CMD.SET_CHANNEL: {
        if (len >= 2 + 32 + 32) return this.err(ERR_CODE.UNSUPPORTED_CMD)
        if (len < 2 + 32 + 16) return this.err(ERR_CODE.UNSUPPORTED_CMD)
        const index = r.u8()
        if (index >= this.maxChannels) return this.err(ERR_CODE.NOT_FOUND)
        const name = fromUtf8z(r.bytesN(NAME_FIELD_SIZE))
        const secret = toHex(r.bytesN(CHANNEL_SECRET_SIZE))
        this.channels[index] = { name, secret }
        this.ok()
        return
      }
      default:
        this.err(ERR_CODE.UNSUPPORTED_CMD)
    }
  }

  private selfInfo(): Uint8Array {
    return concat(
      new Uint8Array([RESP.SELF_INFO, ADV_TYPE.CHAT, 22, 22]),
      fromHex(this.publicKey),
      i32(0),
      i32(0),
      new Uint8Array([0, 0, 0, this.autoAdd ? 0 : 1]),
      u32le(869618),
      u32le(62500),
      new Uint8Array([8, 8]),
      utf8(this.name)
    )
  }

  contactFrame(code: number, c: FakeContact): Uint8Array {
    return concat(
      new Uint8Array([code]),
      fromHex(c.publicKey),
      new Uint8Array([c.type, c.flags, c.outPathLen]),
      new Uint8Array(MAX_PATH_SIZE),
      fixed(c.name, NAME_FIELD_SIZE),
      u32le(c.lastAdvert),
      i32(c.lat),
      i32(c.lon),
      u32le(c.lastMod)
    )
  }

  // ─── Эфир ─────────────────────────────────────────────────────────────────

  /** MyMesh::addToOfflineQueue: при переполнении вытесняется старейшее из канала. */
  private enqueue(frame: Uint8Array): void {
    if (this.offlineQueue.length >= OFFLINE_QUEUE_SIZE) {
      const i = this.offlineQueue.findIndex(
        (f) => f[0] === RESP.CHANNEL_MSG_RECV || f[0] === RESP.CHANNEL_MSG_RECV_V3
      )
      if (i === -1) return // одни ЛС — новое теряется
      this.offlineQueue.splice(i, 1)
    }
    this.offlineQueue.push(frame)
    if (this.connected) this.write(new Uint8Array([PUSH.MSG_WAITING]))
  }

  private async transmitDirect(
    recipient: FakeContact,
    ts: number,
    attempt: number,
    text: string,
    flood: boolean
  ): Promise<void> {
    const air = this.air
    if (!air) return
    if (air.dropMessages > 0) {
      air.dropMessages--
      return
    }
    const target = air.byPrefix(recipient.publicKey.slice(0, 12), this)
    if (!target) return
    const delivered = target.receiveDirect(this, ts, text, flood)
    if (!delivered) return
    if (air.dropAcks > 0) {
      air.dropAcks--
      return
    }
    const ack = await expectedAck(ts, attempt, text, this.publicKey)
    const send = (): void => this.receiveAck(ack)
    if (air.ackDelayMs > 0) setTimeout(send, air.ackDelayMs)
    else send()
    if (flood) {
      // Ответ по flood приносит обратный путь: дальше — напрямую.
      recipient.outPathLen = 1
      if (this.connected)
        this.write(concat(new Uint8Array([PUSH.PATH_UPDATED]), fromHex(recipient.publicKey)))
    }
  }

  /** BaseChatMesh::onPeerDataRecv: расшифровать можно только от контакта. */
  receiveDirect(from: FakeCompanion, ts: number, text: string, flood: boolean): boolean {
    const sender = this.contacts.find((c) => c.publicKey === from.publicKey)
    if (!sender) return false
    sender.lastMod = this.time
    const head =
      this.appVersion >= 3
        ? new Uint8Array([RESP.CONTACT_MSG_RECV_V3, 40, 0, 0])
        : new Uint8Array([RESP.CONTACT_MSG_RECV])
    this.enqueue(
      concat(
        head,
        fromHex(from.publicKey.slice(0, 12)),
        new Uint8Array([flood ? 2 : 0xff, TXT_TYPE.PLAIN]),
        u32le(ts),
        utf8(text)
      )
    )
    return true
  }

  private receiveAck(ack: string): void {
    const sentAt = this.expected.get(ack)
    if (sentAt === undefined) return
    this.expected.delete(ack)
    if (this.connected) {
      this.write(
        concat(new Uint8Array([PUSH.SEND_CONFIRMED]), fromHex(ack), u32le(Date.now() - sentAt))
      )
    }
  }

  private broadcastChannel(secret: string, ts: number, text: string): void {
    for (const r of this.air?.radios ?? []) {
      if (r === this) continue
      const index = r.channels.findIndex((c) => c.secret === secret)
      if (index === -1) continue
      const head =
        r.appVersion >= 3
          ? new Uint8Array([RESP.CHANNEL_MSG_RECV_V3, 28, 0, 0])
          : new Uint8Array([RESP.CHANNEL_MSG_RECV])
      r.enqueue(concat(head, new Uint8Array([index, 1, TXT_TYPE.PLAIN]), u32le(ts), utf8(text)))
    }
  }

  /** BaseChatMesh::onAdvertRecv: новый узел — в контакты или «обнаружен». */
  broadcastAdvert(): void {
    for (const r of this.air?.radios ?? []) {
      if (r !== this) r.receiveAdvert(this)
    }
  }

  receiveAdvert(from: FakeCompanion): void {
    const existing = this.contacts.find((c) => c.publicKey === from.publicKey)
    const contact: FakeContact = existing ?? {
      publicKey: from.publicKey,
      type: ADV_TYPE.CHAT,
      flags: 0,
      outPathLen: OUT_PATH_UNKNOWN,
      name: from.name,
      lastAdvert: from.time,
      lat: 0,
      lon: 0,
      lastMod: this.time,
    }
    contact.name = from.name
    contact.lastAdvert = from.time
    contact.lastMod = this.time
    if (existing || (this.autoAdd && this.contacts.length < this.maxContacts)) {
      if (!existing) this.contacts.push(contact)
      // is_new в прошивке остаётся false и для только что добавленного.
      if (this.connected) this.write(concat(new Uint8Array([PUSH.ADVERT]), fromHex(from.publicKey)))
    } else if (this.connected) {
      this.write(this.contactFrame(PUSH.NEW_ADVERT, contact))
    }
  }

  /** Знакомство двух радио: каждое заносит другое в контакты. */
  static introduce(a: FakeCompanion, b: FakeCompanion): void {
    const entry = (r: FakeCompanion, other: FakeCompanion): FakeContact => ({
      publicKey: other.publicKey,
      type: ADV_TYPE.CHAT,
      flags: 0,
      outPathLen: OUT_PATH_UNKNOWN,
      name: other.name,
      lastAdvert: other.time,
      lat: 0,
      lon: 0,
      lastMod: r.time,
    })
    if (!a.contacts.some((c) => c.publicKey === b.publicKey)) a.contacts.push(entry(a, b))
    if (!b.contacts.some((c) => c.publicKey === a.publicKey)) b.contacts.push(entry(b, a))
  }
}

function decodeFakeContact(frame: Uint8Array): FakeContact {
  const r = new ByteReader(frame)
  r.u8()
  const publicKey = toHex(r.bytesN(PUB_KEY_SIZE))
  const type = r.u8()
  const flags = r.u8()
  const outPathLen = r.u8()
  r.skip(MAX_PATH_SIZE)
  const name = fromUtf8z(r.bytesN(NAME_FIELD_SIZE))
  const lastAdvert = r.u32()
  const lat = r.remaining >= 4 ? r.i32() : 0
  const lon = r.remaining >= 4 ? r.i32() : 0
  const lastMod = r.remaining >= 4 ? r.u32() : 0
  return { publicKey, type, flags, outPathLen, name, lastAdvert, lat, lon, lastMod }
}
