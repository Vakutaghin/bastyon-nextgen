/**
 * ToRadio/FromRadio Meshtastic ⇄ простые типы приложения.
 *
 * Протобуфы (@meshtastic/protobufs, @bufbuild/protobuf) нужны только здесь и
 * в сеансе — всё это грузится ленивым чанком при подключении радио. Наружу
 * уходят обычные объекты; «сырые» protobuf-объекты своего узла (User,
 * LoRaConfig) сеанс держит, чтобы отправлять их обратно с правками.
 */

import { create, fromBinary, toBinary, type MessageInitShape } from '@bufbuild/protobuf'
import { Admin, AppOnly, Channel, Config, Mesh, Portnums, Telemetry } from '@meshtastic/protobufs'

import { fromHex, toHex } from '../bytes'
import { BROADCAST_NUM } from './constants'

export const PortNum = Portnums.PortNum
export const RoutingError = Mesh.Routing_Error
export const ChannelRole = Channel.Channel_Role
export const RegionCode = Config.Config_LoRaConfig_RegionCode

export type RawUser = Mesh.User
export type RawLoRaConfig = Config.Config_LoRaConfig
export type RawChannelSettings = Channel.ChannelSettings
export type AdminInit = MessageInitShape<typeof Admin.AdminMessageSchema>

// ─── Типы приложения ──────────────────────────────────────────────────────

export interface MtUser {
  /** `!a1b2c3d4`. */
  id: string
  longName: string
  shortName: string
  hwModel: number
  /** Имя модели платы из прошивки (`HELTEC_V3`), если известно. */
  hwModelName: string | null
  role: number
  /** Открытый ключ X25519 (hex); без него ЛС не шифруются. */
  publicKey: string | null
  isLicensed: boolean
  isUnmessagable: boolean
}

export interface MtPosition {
  latitude: number
  longitude: number
  altitude: number | null
  /** Секунды по часам узла; 0 — неизвестно. */
  time: number
}

export interface MtNode {
  num: number
  user: MtUser | null
  snr: number
  /** Когда узел слышали, секунды (по часам радио); 0 — никогда. */
  lastHeard: number
  hopsAway: number | null
  viaMqtt: boolean
  isFavorite: boolean
  isIgnored: boolean
  channel: number
  battery: number | null
  voltage: number | null
  position: MtPosition | null
}

export interface MtMyInfo {
  nodeNum: number
  rebootCount: number
  minAppVersion: number
  nodedbCount: number
}

export interface MtMetadata {
  firmwareVersion: string
  hwModel: number
  hwModelName: string | null
  role: number
  hasBluetooth: boolean
  hasWifi: boolean
  hasPKC: boolean
  canShutdown: boolean
}

export type MtChannelRole = 'primary' | 'secondary' | 'disabled'

export interface MtChannel {
  index: number
  role: MtChannelRole
  /** Имя как записано на радио; пустое у основного — «имя пресета». */
  name: string
  psk: Uint8Array
  uplinkEnabled: boolean
  downlinkEnabled: boolean
  positionPrecision: number
  muted: boolean
}

export interface MtLoRa {
  region: number
  usePreset: boolean
  modemPreset: number
  hopLimit: number
  txEnabled: boolean
  txPower: number
}

export interface MtData {
  portnum: number
  payload: Uint8Array
  wantResponse: boolean
  requestId: number
  replyId: number
  emoji: number
}

export interface MtPacket {
  from: number
  to: number
  id: number
  channel: number
  /** Время приёма радио, секунды; 0 — неизвестно. */
  rxTime: number
  rxSnr: number
  rxRssi: number | null
  hopStart: number
  hopLimit: number
  wantAck: boolean
  viaMqtt: boolean
  pkiEncrypted: boolean
  /** null — радио не смогло расшифровать (чужой канал). */
  decoded: MtData | null
}

export interface MtQueueStatus {
  res: number
  free: number
  maxlen: number
  packetId: number
}

export type MtConfig =
  | { kind: 'lora'; lora: MtLoRa; raw: RawLoRaConfig }
  | { kind: 'other'; section: string }

export type MtFromRadio =
  | { kind: 'myInfo'; info: MtMyInfo }
  | { kind: 'nodeInfo'; node: MtNode; rawUser: RawUser | null }
  | { kind: 'channel'; channel: MtChannel }
  | { kind: 'config'; config: MtConfig }
  | { kind: 'metadata'; metadata: MtMetadata }
  | { kind: 'configComplete'; id: number }
  | { kind: 'packet'; packet: MtPacket }
  | { kind: 'queueStatus'; status: MtQueueStatus }
  | { kind: 'rebooted' }
  | { kind: 'notification'; level: number; message: string; replyId: number | null }
  | { kind: 'log'; level: number; message: string }
  | { kind: 'other'; case: string }

// ─── Разбор ───────────────────────────────────────────────────────────────

export function nodeIdOf(num: number): string {
  return `!${(num >>> 0).toString(16).padStart(8, '0')}`
}

function hwName(model: number): string | null {
  const name = Mesh.HardwareModel[model]
  return typeof name === 'string' && name !== 'UNSET' ? name : null
}

export function userFromRaw(u: RawUser, num: number): MtUser {
  return {
    id: u.id || nodeIdOf(num),
    longName: u.longName,
    shortName: u.shortName,
    hwModel: u.hwModel,
    hwModelName: hwName(u.hwModel),
    role: u.role,
    publicKey: u.publicKey.length === 32 ? toHex(u.publicKey) : null,
    isLicensed: u.isLicensed,
    isUnmessagable: u.isUnmessagable ?? false,
  }
}

function positionFromRaw(p: Mesh.Position | undefined): MtPosition | null {
  if (!p || p.latitudeI === undefined || p.longitudeI === undefined) return null
  if (p.latitudeI === 0 && p.longitudeI === 0) return null
  return {
    latitude: p.latitudeI / 1e7,
    longitude: p.longitudeI / 1e7,
    altitude: p.altitude ?? null,
    time: p.time ?? 0,
  }
}

function nodeFromRaw(n: Mesh.NodeInfo): MtNode {
  return {
    num: n.num >>> 0,
    user: n.user ? userFromRaw(n.user, n.num) : null,
    snr: n.snr,
    lastHeard: n.lastHeard,
    hopsAway: n.hopsAway ?? null,
    viaMqtt: n.viaMqtt,
    isFavorite: n.isFavorite,
    isIgnored: n.isIgnored,
    channel: n.channel,
    battery: n.deviceMetrics?.batteryLevel ?? null,
    voltage: n.deviceMetrics?.voltage ?? null,
    position: positionFromRaw(n.position),
  }
}

function roleOf(role: Channel.Channel_Role): MtChannelRole {
  if (role === ChannelRole.PRIMARY) return 'primary'
  if (role === ChannelRole.SECONDARY) return 'secondary'
  return 'disabled'
}

export function channelFromRaw(c: Channel.Channel): MtChannel {
  const s = c.settings
  return {
    index: c.index,
    role: roleOf(c.role),
    name: s?.name ?? '',
    psk: s?.psk ?? new Uint8Array(0),
    uplinkEnabled: s?.uplinkEnabled ?? false,
    downlinkEnabled: s?.downlinkEnabled ?? false,
    positionPrecision: s?.moduleSettings?.positionPrecision ?? 0,
    muted: s?.moduleSettings?.isMuted ?? false,
  }
}

export function loraFromRaw(l: RawLoRaConfig): MtLoRa {
  return {
    region: l.region,
    usePreset: l.usePreset,
    modemPreset: l.modemPreset,
    hopLimit: l.hopLimit,
    txEnabled: l.txEnabled,
    txPower: l.txPower,
  }
}

function packetFromRaw(p: Mesh.MeshPacket): MtPacket {
  const d = p.payloadVariant.case === 'decoded' ? p.payloadVariant.value : null
  return {
    from: p.from >>> 0,
    to: p.to >>> 0,
    id: p.id >>> 0,
    channel: p.channel,
    rxTime: p.rxTime ?? 0,
    rxSnr: p.rxSnr,
    rxRssi: p.rxRssi ?? null,
    hopStart: p.hopStart,
    hopLimit: p.hopLimit,
    wantAck: p.wantAck,
    viaMqtt: p.viaMqtt,
    pkiEncrypted: p.pkiEncrypted,
    decoded: d
      ? {
          portnum: d.portnum,
          payload: d.payload,
          wantResponse: d.wantResponse,
          requestId: d.requestId >>> 0,
          replyId: d.replyId >>> 0,
          emoji: d.emoji,
        }
      : null,
  }
}

/** FromRadio из байтов. Битый protobuf — исключение (сеанс его пропустит). */
export function decodeFromRadio(bytes: Uint8Array): MtFromRadio {
  const m = fromBinary(Mesh.FromRadioSchema, bytes)
  const v = m.payloadVariant
  switch (v.case) {
    case 'myInfo':
      return {
        kind: 'myInfo',
        info: {
          nodeNum: v.value.myNodeNum >>> 0,
          rebootCount: v.value.rebootCount,
          minAppVersion: v.value.minAppVersion,
          nodedbCount: v.value.nodedbCount,
        },
      }
    case 'nodeInfo':
      return { kind: 'nodeInfo', node: nodeFromRaw(v.value), rawUser: v.value.user ?? null }
    case 'channel':
      return { kind: 'channel', channel: channelFromRaw(v.value) }
    case 'config': {
      const c = v.value.payloadVariant
      if (c.case === 'lora') {
        return {
          kind: 'config',
          config: { kind: 'lora', lora: loraFromRaw(c.value), raw: c.value },
        }
      }
      return { kind: 'config', config: { kind: 'other', section: c.case ?? 'unknown' } }
    }
    case 'metadata':
      return {
        kind: 'metadata',
        metadata: {
          firmwareVersion: v.value.firmwareVersion,
          hwModel: v.value.hwModel,
          hwModelName: hwName(v.value.hwModel),
          role: v.value.role,
          hasBluetooth: v.value.hasBluetooth,
          hasWifi: v.value.hasWifi,
          hasPKC: v.value.hasPKC,
          canShutdown: v.value.canShutdown,
        },
      }
    case 'configCompleteId':
      return { kind: 'configComplete', id: v.value >>> 0 }
    case 'packet':
      return { kind: 'packet', packet: packetFromRaw(v.value) }
    case 'queueStatus':
      return {
        kind: 'queueStatus',
        status: {
          res: v.value.res,
          free: v.value.free,
          maxlen: v.value.maxlen,
          packetId: v.value.meshPacketId >>> 0,
        },
      }
    case 'rebooted':
      return { kind: 'rebooted' }
    case 'clientNotification':
      return {
        kind: 'notification',
        level: v.value.level,
        message: v.value.message,
        replyId: v.value.replyId ?? null,
      }
    case 'logRecord':
      return { kind: 'log', level: v.value.level, message: v.value.message }
    default:
      return { kind: 'other', case: v.case ?? 'empty' }
  }
}

export function decodeRoutingError(payload: Uint8Array): number | null {
  const r = fromBinary(Mesh.RoutingSchema, payload)
  return r.variant.case === 'errorReason' ? r.variant.value : RoutingError.NONE
}

export function decodeUser(payload: Uint8Array): RawUser {
  return fromBinary(Mesh.UserSchema, payload)
}

export function decodePosition(payload: Uint8Array): MtPosition | null {
  return positionFromRaw(fromBinary(Mesh.PositionSchema, payload))
}

/** Заряд из телеметрии устройства; null — пакет не о батарее. */
export function decodeDeviceMetrics(
  payload: Uint8Array
): { battery: number | null; voltage: number | null } | null {
  const t = fromBinary(Telemetry.TelemetrySchema, payload)
  if (t.variant.case !== 'deviceMetrics') return null
  return { battery: t.variant.value.batteryLevel ?? null, voltage: t.variant.value.voltage ?? null }
}

export function decodeAdmin(payload: Uint8Array): Admin.AdminMessage {
  return fromBinary(Admin.AdminMessageSchema, payload)
}

// ─── Сборка ───────────────────────────────────────────────────────────────

function toRadio(init: MessageInitShape<typeof Mesh.ToRadioSchema>): Uint8Array {
  return toBinary(Mesh.ToRadioSchema, create(Mesh.ToRadioSchema, init))
}

export function encodeWantConfig(nonce: number): Uint8Array {
  return toRadio({ payloadVariant: { case: 'wantConfigId', value: nonce >>> 0 } })
}

export function encodeHeartbeat(nonce: number): Uint8Array {
  return toRadio({ payloadVariant: { case: 'heartbeat', value: { nonce: nonce >>> 0 } } })
}

export function encodeDisconnect(): Uint8Array {
  return toRadio({ payloadVariant: { case: 'disconnect', value: true } })
}

export interface PacketInit {
  /** Свой номер: без него NAK прошивки (например, RATE_LIMIT) уйдёт «никому». */
  from?: number
  to: number
  id: number
  channel: number
  portnum: number
  payload: Uint8Array
  wantAck?: boolean
  wantResponse?: boolean
  hopLimit?: number
  replyId?: number
  emoji?: number
  /** ЛС с шифрованием на ключах узлов: ключ получателя. */
  publicKey?: Uint8Array
}

export function encodePacket(p: PacketInit): Uint8Array {
  return toRadio({
    payloadVariant: {
      case: 'packet',
      value: {
        from: (p.from ?? 0) >>> 0,
        to: p.to >>> 0,
        id: p.id >>> 0,
        channel: p.channel,
        wantAck: p.wantAck ?? false,
        hopLimit: p.hopLimit ?? 0,
        pkiEncrypted: p.publicKey !== undefined,
        publicKey: p.publicKey ?? new Uint8Array(0),
        payloadVariant: {
          case: 'decoded',
          value: {
            portnum: p.portnum,
            payload: p.payload,
            wantResponse: p.wantResponse ?? false,
            replyId: p.replyId ?? 0,
            emoji: p.emoji ?? 0,
          },
        },
      },
    },
  })
}

export function encodeText(
  p: Omit<PacketInit, 'portnum' | 'payload'> & { text: string }
): Uint8Array {
  return encodePacket({
    ...p,
    portnum: PortNum.TEXT_MESSAGE_APP,
    payload: new TextEncoder().encode(p.text),
  })
}

export function encodeUser(user: RawUser): Uint8Array {
  return toBinary(Mesh.UserSchema, user)
}

export function encodeAdminPayload(admin: AdminInit): Uint8Array {
  return toBinary(Admin.AdminMessageSchema, create(Admin.AdminMessageSchema, admin))
}

export function isBroadcast(num: number): boolean {
  return num >>> 0 === BROADCAST_NUM
}

// ─── Каналы в ссылке ──────────────────────────────────────────────────────

export interface ChannelSetShare {
  channels: Array<{ name: string; psk: Uint8Array }>
  /** Регион и пресет из ссылки, если они там есть. */
  lora: MtLoRa | null
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const bin = atob(b64 + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** Ссылка на каналы `https://meshtastic.org/e/#…` — как в официальных приложениях. */
export function encodeChannelUrl(
  channels: Array<{ name: string; psk: Uint8Array }>,
  lora: RawLoRaConfig | null,
  add = false
): string {
  // Ссылка «добавить» не несёт настроек радио — так же делает приложение для Android.
  const set = create(AppOnly.ChannelSetSchema, {
    settings: channels.map((c) => ({ name: c.name, psk: c.psk })),
    loraConfig: add ? undefined : (lora ?? undefined),
  })
  const hash = base64UrlEncode(toBinary(AppOnly.ChannelSetSchema, set))
  return `https://meshtastic.org/e/${add ? '?add=true' : ''}#${hash}`
}

/** Каналы из ссылки или `null`, если это не ссылка Meshtastic на каналы. */
export function decodeChannelUrl(url: string): ChannelSetShare | null {
  const trimmed = url.trim()
  const hashAt = trimmed.indexOf('#')
  if (hashAt === -1 || !/meshtastic\.org\/e\//i.test(trimmed.slice(0, hashAt))) return null
  try {
    const set = fromBinary(AppOnly.ChannelSetSchema, base64UrlDecode(trimmed.slice(hashAt + 1)))
    if (set.settings.length === 0) return null
    return {
      channels: set.settings.map((s) => ({ name: s.name, psk: s.psk })),
      lora: set.loraConfig ? loraFromRaw(set.loraConfig) : null,
    }
  } catch {
    return null
  }
}

export function rawChannelSettings(name: string, psk: Uint8Array): RawChannelSettings {
  return create(Channel.ChannelSettingsSchema, { name, psk })
}

export function rawLoRa(init: RawLoRaConfig, patch: Partial<MtLoRa>): RawLoRaConfig {
  return create(Config.Config_LoRaConfigSchema, { ...init, ...patch })
}

export function rawUser(init: RawUser, patch: { longName?: string; shortName?: string }): RawUser {
  return create(Mesh.UserSchema, { ...init, ...patch })
}

export { fromHex }
