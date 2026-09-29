/**
 * Кодек companion-протокола MeshCore: команды приложения и разбор кадров радио.
 * Раскладка байтов — как в examples/companion_radio/MyMesh.cpp (ссылки на
 * функции прошивки у каждого кадра). Все числа little-endian.
 */

import { ByteReader, concat, fromHex, fromUtf8, fromUtf8z, toHex, u32le, utf8 } from '../bytes'
import {
  CHANNEL_SECRET_SIZE,
  CMD,
  MAX_PATH_SIZE,
  NAME_FIELD_SIZE,
  PUB_KEY_SIZE,
  PUSH,
  RESP,
  TXT_TYPE,
} from './constants'

// ─── Типы кадров радио ──────────────────────────────────────────────────────

/** RESP_CODE_SELF_INFO — ответ на APP_START. */
export interface McSelfInfo {
  advType: number
  txPower: number
  maxTxPower: number
  /** Открытый ключ узла, hex (64 знака). */
  publicKey: string
  lat: number | null
  lon: number | null
  multiAcks: number
  advertLocPolicy: number
  telemetryModes: number
  manualAddContacts: boolean
  /** МГц. */
  radioFreq: number
  /** кГц. */
  radioBw: number
  radioSf: number
  radioCr: number
  name: string
}

/** RESP_CODE_DEVICE_INFO — ответ на DEVICE_QUERY. */
export interface McDeviceInfo {
  /** FIRMWARE_VER_CODE: 13 у прошивок 1.16–1.17. */
  firmwareVerCode: number
  maxContacts: number | null
  maxChannels: number | null
  blePin: number | null
  buildDate: string
  model: string
  version: string
}

/** Контакт из таблицы радио (writeContactRespFrame). */
export interface McContact {
  publicKey: string
  /** ADV_TYPE_*. */
  type: number
  flags: number
  /** OUT_PATH_UNKNOWN (0xFF) — пути нет, сообщения идут flood'ом. */
  outPathLen: number
  name: string
  /** Время объявления по часам отправителя, секунды. */
  lastAdvert: number
  lat: number | null
  lon: number | null
  /** Когда контакт менялся на радио, секунды. */
  lastMod: number
}

export interface McChannel {
  index: number
  name: string
  /** Ключ канала, hex (32 знака). */
  secret: string
}

export type McIncoming =
  | {
      kind: 'contact'
      /** Первые 6 байт ключа отправителя, hex. */
      senderPrefix: string
      pathLen: number
      txtType: number
      /** Секунды по часам отправителя. */
      senderTimestamp: number
      text: string
      snr: number | null
      /** TXT_TYPE_SIGNED_PLAIN (room server): префикс ключа автора. */
      authorPrefix: string | null
    }
  | {
      kind: 'channel'
      channelIndex: number
      pathLen: number
      txtType: number
      senderTimestamp: number
      text: string
      snr: number | null
    }
  | {
      kind: 'channelData'
      channelIndex: number
      pathLen: number
      dataType: number
      payload: Uint8Array
      snr: number | null
    }

export interface McSent {
  /** Ушло flood'ом (пути до получателя нет). */
  flood: boolean
  /** Ожидаемый ACK, 4 байта hex. */
  ack: string
  /** Оценка радио, сколько ждать ACK, мс. */
  timeoutMs: number
}

export interface McBattery {
  millivolts: number
  usedKb: number | null
  totalKb: number | null
}

// ─── Команды ────────────────────────────────────────────────────────────────

function fixedName(name: string, size = NAME_FIELD_SIZE): Uint8Array {
  // Поле с нулём в конце: прошивка копирует его strncpy/strzcpy.
  const bytes = utf8(name).slice(0, size - 1)
  const out = new Uint8Array(size)
  out.set(bytes)
  return out
}

function keyBytes(publicKeyHex: string, size = PUB_KEY_SIZE): Uint8Array {
  const bytes = fromHex(publicKeyHex)
  if (bytes.length < size) throw new RangeError(`key shorter than ${size} bytes`)
  return bytes.slice(0, size)
}

export const encode = {
  /** Байты 1–7 зарезервированы, дальше имя приложения. */
  appStart: (appName: string): Uint8Array =>
    concat(new Uint8Array([CMD.APP_START, 0, 0, 0, 0, 0, 0, 0]), utf8(appName)),
  deviceQuery: (appVersion: number): Uint8Array => new Uint8Array([CMD.DEVICE_QUERY, appVersion]),
  getDeviceTime: (): Uint8Array => new Uint8Array([CMD.GET_DEVICE_TIME]),
  setDeviceTime: (unixSeconds: number): Uint8Array =>
    concat(new Uint8Array([CMD.SET_DEVICE_TIME]), u32le(unixSeconds)),
  getContacts: (since?: number): Uint8Array =>
    since
      ? concat(new Uint8Array([CMD.GET_CONTACTS]), u32le(since))
      : new Uint8Array([CMD.GET_CONTACTS]),
  getContactByKey: (publicKey: string): Uint8Array =>
    concat(new Uint8Array([CMD.GET_CONTACT_BY_KEY]), keyBytes(publicKey)),
  getChannel: (index: number): Uint8Array => new Uint8Array([CMD.GET_CHANNEL, index]),
  setChannel: (index: number, name: string, secretHex: string): Uint8Array => {
    const secret = fromHex(secretHex)
    if (secret.length !== CHANNEL_SECRET_SIZE)
      throw new RangeError('channel secret must be 16 bytes')
    return concat(new Uint8Array([CMD.SET_CHANNEL, index]), fixedName(name), secret)
  },
  /** Личное сообщение: получатель — первые 6 байт ключа. */
  sendText: (publicKey: string, text: string, timestamp: number, attempt: number): Uint8Array =>
    concat(
      new Uint8Array([CMD.SEND_TXT_MSG, TXT_TYPE.PLAIN, attempt & 3]),
      u32le(timestamp),
      keyBytes(publicKey, 6),
      utf8(text)
    ),
  /** Вход в комнату: полный ключ и пароль (без завершающего нуля — его допишет радио). */
  sendLogin: (publicKey: string, password: string): Uint8Array =>
    concat(new Uint8Array([CMD.SEND_LOGIN]), keyBytes(publicKey), utf8(password)),
  sendChannelText: (channelIndex: number, text: string, timestamp: number): Uint8Array =>
    concat(
      new Uint8Array([CMD.SEND_CHANNEL_TXT_MSG, TXT_TYPE.PLAIN, channelIndex]),
      u32le(timestamp),
      utf8(text)
    ),
  syncNextMessage: (): Uint8Array => new Uint8Array([CMD.SYNC_NEXT_MESSAGE]),
  resetPath: (publicKey: string): Uint8Array =>
    concat(new Uint8Array([CMD.RESET_PATH]), keyBytes(publicKey)),
  /** flood — объявить себя по всей сети, иначе только соседям. */
  sendSelfAdvert: (flood: boolean): Uint8Array =>
    new Uint8Array([CMD.SEND_SELF_ADVERT, flood ? 1 : 0]),
  setAdvertName: (name: string): Uint8Array =>
    concat(new Uint8Array([CMD.SET_ADVERT_NAME]), utf8(name).slice(0, NAME_FIELD_SIZE - 1)),
  /** Кадр контакта целиком — как его отдаёт writeContactRespFrame. */
  addUpdateContact: (c: McContact): Uint8Array => {
    const path = new Uint8Array(MAX_PATH_SIZE)
    return concat(
      new Uint8Array([CMD.ADD_UPDATE_CONTACT]),
      keyBytes(c.publicKey),
      new Uint8Array([c.type, c.flags, c.outPathLen]),
      path,
      fixedName(c.name),
      u32le(c.lastAdvert),
      i32Coord(c.lat),
      i32Coord(c.lon),
      u32le(c.lastMod)
    )
  },
  removeContact: (publicKey: string): Uint8Array =>
    concat(new Uint8Array([CMD.REMOVE_CONTACT]), keyBytes(publicKey)),
  getBattery: (): Uint8Array => new Uint8Array([CMD.GET_BATT_AND_STORAGE]),
  signStart: (): Uint8Array => new Uint8Array([CMD.SIGN_START]),
  signData: (chunk: Uint8Array): Uint8Array => concat(new Uint8Array([CMD.SIGN_DATA]), chunk),
  signFinish: (): Uint8Array => new Uint8Array([CMD.SIGN_FINISH]),
}

function i32Coord(value: number | null): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setInt32(0, Math.round((value ?? 0) * 1e6), true)
  return out
}

function coord(raw: number): number | null {
  return raw === 0 ? null : raw / 1e6
}

// ─── Разбор кадров ──────────────────────────────────────────────────────────

/** MyMesh::handleCmdFrame, ветка CMD_APP_START. */
export function decodeSelfInfo(frame: Uint8Array): McSelfInfo {
  const r = new ByteReader(frame)
  expectCode(r.u8(), RESP.SELF_INFO)
  const advType = r.u8()
  const txPower = r.i8()
  const maxTxPower = r.i8()
  const publicKey = toHex(r.bytesN(PUB_KEY_SIZE))
  const lat = coord(r.i32())
  const lon = coord(r.i32())
  const multiAcks = r.u8()
  const advertLocPolicy = r.u8()
  const telemetryModes = r.u8()
  const manualAddContacts = r.u8() !== 0
  const radioFreq = r.u32() / 1000
  const radioBw = r.u32() / 1000
  const radioSf = r.u8()
  const radioCr = r.u8()
  const name = fromUtf8z(r.rest()).trim()
  return {
    advType,
    txPower,
    maxTxPower,
    publicKey,
    lat,
    lon,
    multiAcks,
    advertLocPolicy,
    telemetryModes,
    manualAddContacts,
    radioFreq,
    radioBw,
    radioSf,
    radioCr,
    name,
  }
}

/** Ветка CMD_DEVICE_QUERY. Старые прошивки (версия < 3) шлют только версию. */
export function decodeDeviceInfo(frame: Uint8Array): McDeviceInfo {
  const r = new ByteReader(frame)
  expectCode(r.u8(), RESP.DEVICE_INFO)
  const firmwareVerCode = r.u8()
  const info: McDeviceInfo = {
    firmwareVerCode,
    maxContacts: null,
    maxChannels: null,
    blePin: null,
    buildDate: '',
    model: '',
    version: '',
  }
  if (firmwareVerCode >= 3 && r.remaining >= 2 + 4 + 12 + 40 + 20) {
    info.maxContacts = r.u8() * 2
    info.maxChannels = r.u8()
    info.blePin = r.u32()
    info.buildDate = fromUtf8z(r.bytesN(12)).trim()
    info.model = fromUtf8z(r.bytesN(40)).trim()
    info.version = fromUtf8z(r.bytesN(20)).trim()
  }
  return info
}

/** writeContactRespFrame: RESP_CODE_CONTACT и PUSH_CODE_NEW_ADVERT. */
export function decodeContact(frame: Uint8Array): McContact {
  const r = new ByteReader(frame)
  r.u8() // код кадра
  const publicKey = toHex(r.bytesN(PUB_KEY_SIZE))
  const type = r.u8()
  const flags = r.u8()
  const outPathLen = r.u8()
  r.skip(MAX_PATH_SIZE)
  const name = fromUtf8z(r.bytesN(NAME_FIELD_SIZE)).trim()
  const lastAdvert = r.u32()
  const lat = r.remaining >= 4 ? coord(r.i32()) : null
  const lon = r.remaining >= 4 ? coord(r.i32()) : null
  const lastMod = r.remaining >= 4 ? r.u32() : 0
  return { publicKey, type, flags, outPathLen, name, lastAdvert, lat, lon, lastMod }
}

/** CMD_GET_CHANNEL: имя — строка до нуля в поле 32 байта, за ним ключ 16 байт. */
export function decodeChannelInfo(frame: Uint8Array): McChannel {
  const r = new ByteReader(frame)
  expectCode(r.u8(), RESP.CHANNEL_INFO)
  const index = r.u8()
  const name = fromUtf8z(r.bytesN(NAME_FIELD_SIZE)).trim()
  const secret = toHex(r.bytesN(CHANNEL_SECRET_SIZE))
  return { index, name, secret }
}

/** Слот канала пуст: без имени и с нулевым ключом. */
export function isEmptyChannel(c: McChannel): boolean {
  return c.name === '' && /^0+$/.test(c.secret)
}

/** RESP_CODE_SENT — ответ на CMD_SEND_TXT_MSG. ACK — 4 байта как есть. */
export function decodeSent(frame: Uint8Array): McSent {
  const r = new ByteReader(frame)
  expectCode(r.u8(), RESP.SENT)
  const flood = r.u8() === 1
  const ack = toHex(r.bytesN(4))
  const timeoutMs = r.u32()
  return { flood, ack, timeoutMs }
}

/** Итог входа в комнату (MyMesh::onContactResponse). */
export interface McLoginResult {
  ok: boolean
  /** Первые 6 байт ключа комнаты (hex). */
  prefix: string
  /** Права: бит 0 — администратор. */
  permissions: number
}

/** PUSH_CODE_LOGIN_SUCCESS / LOGIN_FAIL: код, права, 6 байт ключа комнаты, дальше — по версии. */
export function decodeLoginResult(frame: Uint8Array): McLoginResult {
  const r = new ByteReader(frame)
  const code = r.u8()
  const permissions = r.u8()
  const prefix = toHex(r.bytesN(6))
  return { ok: code === PUSH.LOGIN_SUCCESS, prefix, permissions }
}

/** PUSH_CODE_SEND_CONFIRMED (MyMesh::processAck): ACK и время пути, мс. */
export function decodeSendConfirmed(frame: Uint8Array): { ack: string; tripMs: number } {
  const r = new ByteReader(frame)
  r.u8()
  const ack = toHex(r.bytesN(4))
  const tripMs = r.remaining >= 4 ? r.u32() : 0
  return { ack, tripMs }
}

/** Кадры с ключом после кода: PUSH_ADVERT, PATH_UPDATED, CONTACT_DELETED. */
export function decodeKeyPush(frame: Uint8Array): string {
  const r = new ByteReader(frame)
  r.u8()
  return toHex(r.bytesN(PUB_KEY_SIZE))
}

export function decodeBattery(frame: Uint8Array): McBattery {
  const r = new ByteReader(frame)
  expectCode(r.u8(), RESP.BATT_AND_STORAGE)
  const millivolts = r.u16()
  const usedKb = r.remaining >= 4 ? r.u32() : null
  const totalKb = r.remaining >= 4 ? r.u32() : null
  return { millivolts, usedKb, totalKb }
}

export function decodeU32After(frame: Uint8Array): number {
  const r = new ByteReader(frame)
  r.u8()
  return r.remaining >= 4 ? r.u32() : 0
}

/** Коды кадров-сообщений (ответы на SYNC_NEXT_MESSAGE). */
export const MESSAGE_CODES: ReadonlySet<number> = new Set([
  RESP.CONTACT_MSG_RECV,
  RESP.CHANNEL_MSG_RECV,
  RESP.CONTACT_MSG_RECV_V3,
  RESP.CHANNEL_MSG_RECV_V3,
  RESP.CHANNEL_DATA_RECV,
])

/** MyMesh::queueMessage / onChannelMessageRecv / onChannelDataRecv. */
export function decodeIncoming(frame: Uint8Array): McIncoming {
  const r = new ByteReader(frame)
  const code = r.u8()
  const readSnr = (): number => {
    const snr = r.i8() / 4
    r.skip(2) // зарезервировано
    return snr
  }
  switch (code) {
    case RESP.CONTACT_MSG_RECV:
    case RESP.CONTACT_MSG_RECV_V3: {
      const snr = code === RESP.CONTACT_MSG_RECV_V3 ? readSnr() : null
      const senderPrefix = toHex(r.bytesN(6))
      const pathLen = r.u8()
      const txtType = r.u8()
      const senderTimestamp = r.u32()
      const authorPrefix = txtType === TXT_TYPE.SIGNED_PLAIN ? toHex(r.bytesN(4)) : null
      const text = fromUtf8(r.rest())
      return {
        kind: 'contact',
        senderPrefix,
        pathLen,
        txtType,
        senderTimestamp,
        text,
        snr,
        authorPrefix,
      }
    }
    case RESP.CHANNEL_MSG_RECV:
    case RESP.CHANNEL_MSG_RECV_V3: {
      const snr = code === RESP.CHANNEL_MSG_RECV_V3 ? readSnr() : null
      const channelIndex = r.u8()
      const pathLen = r.u8()
      const txtType = r.u8()
      const senderTimestamp = r.u32()
      const text = fromUtf8(r.rest())
      return { kind: 'channel', channelIndex, pathLen, txtType, senderTimestamp, text, snr }
    }
    case RESP.CHANNEL_DATA_RECV: {
      const snr = readSnr()
      const channelIndex = r.u8()
      const pathLen = r.u8()
      const dataType = r.u16()
      const len = r.u8()
      const payload = r.bytesN(Math.min(len, r.remaining))
      return { kind: 'channelData', channelIndex, pathLen, dataType, payload, snr }
    }
    default:
      throw new RangeError(`not a message frame: ${code}`)
  }
}

/**
 * Текст сообщения в канале — «имя: текст» (BaseChatMesh::sendGroupMessage):
 * имя отправителя пишет его радио, подписи нет, подделать его может любой, у
 * кого есть ключ канала.
 */
export function splitChannelText(text: string): { sender: string | null; body: string } {
  const at = text.indexOf(': ')
  if (at > 0 && at <= NAME_FIELD_SIZE)
    return { sender: text.slice(0, at), body: text.slice(at + 2) }
  return { sender: null, body: text }
}

function expectCode(actual: number, expected: number): void {
  if (actual !== expected) throw new RangeError(`unexpected frame ${actual}, want ${expected}`)
}

/** Число путей в закодированной длине пути (младшие 6 бит), 0xFF — пути нет. */
export function hopCount(pathLen: number): number | null {
  if (pathLen === 0xff) return null
  return pathLen & 0x3f
}
