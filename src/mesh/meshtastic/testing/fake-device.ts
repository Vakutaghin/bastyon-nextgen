/**
 * Поддельное радио Meshtastic для тестов: ведёт себя как прошивка 2.7 там,
 * где это важно клиенту (сверено с meshtasticd 2.7.26 в симуляции):
 *
 * - рукопожатие: my_info, свой NodeInfo, metadata, 8 каналов, config (lora и
 *   ещё одна секция), остальные узлы, config_complete_id с номером клиента;
 * - на каждый пакет от клиента — queueStatus с его id;
 * - ЛС с известным ключом уходит с PKI; без ключа — «legacy», и получатель
 *   2.6+ отвечает NAK NO_CHANNEL;
 * - получатель ЛС подтверждает Routing NONE от себя; сообщение в канал
 *   подтверждается неявно (Routing NONE от своего узла), если его кто-то
 *   услышал; иначе — MAX_RETRANSMIT;
 * - admin своему узлу: ответ Routing NONE; смена региона или пресета
 *   перезагружает радио (соединение рвётся);
 * - NodeInfo с want_response: получатель запоминает ключ и отвечает своим
 *   (если не «недавно отвечал» — флаг `nodeInfoThrottled`);
 * - пока клиента нет, входящие копятся и отдаются после рукопожатия.
 */

import { create, fromBinary, toBinary, type MessageInitShape } from '@bufbuild/protobuf'
import { Admin, Channel, Config, Mesh, Portnums } from '@meshtastic/protobufs'

import type { CloseReason, Unsubscribe } from '../../radio/types'
import { BROADCAST_NUM } from '../constants'
import { expandPsk } from '../channels'
import type { PacketLink } from '../framing'

const PortNum = Portnums.PortNum
const RoutingError = Mesh.Routing_Error

type FromRadioInit = MessageInitShape<typeof Mesh.FromRadioSchema>

interface AirPacket {
  from: number
  to: number
  id: number
  /** Ключ канала, которым зашифровано; null — PKI. */
  channel: { name: string; key: string } | null
  pki: boolean
  portnum: number
  payload: Uint8Array
  wantResponse: boolean
  wantAck: boolean
  requestId: number
  replyId: number
  emoji: number
  hopStart: number
  hopLimit: number
}

/** «Эфир» между поддельными радио. */
export class FakeMeshAir {
  readonly devices = new Set<FakeMeshtasticDevice>()

  byNum(num: number): FakeMeshtasticDevice | undefined {
    for (const d of this.devices) if (d.nodeNum === num) return d
    return undefined
  }
  /** Терять все тексты. */
  dropText = false
  /** Терять подтверждения ЛС. */
  dropAcks = false

  transmit(sender: FakeMeshtasticDevice, packet: AirPacket): number {
    let heard = 0
    for (const d of this.devices) {
      if (d === sender) continue
      if (packet.portnum === PortNum.TEXT_MESSAGE_APP && this.dropText) continue
      if (packet.portnum === PortNum.ROUTING_APP && this.dropAcks) continue
      if (d.hearFromAir(packet)) heard++
    }
    return heard
  }
}

function keyOf(name: string, psk: Uint8Array): { name: string; key: string } {
  return { name, key: Array.from(expandPsk(psk)).join(',') }
}

let nextNodeNum = 0x2233_4400

export interface FakeDeviceInit {
  longName: string
  shortName?: string
  nodeNum?: number
  region?: number
  /** Прошивка до 2.5: без ключей, ЛС без PKI. */
  noPki?: boolean
}

export class FakeMeshtasticDevice {
  readonly nodeNum: number
  user: Mesh.User
  lora: Config.Config_LoRaConfig
  channels: Channel.Channel[]
  readonly nodeDb = new Map<number, Mesh.NodeInfo>()
  /** Не отвечать на просьбы NodeInfo (прошивка отвечает не чаще раза в 10 мин). */
  nodeInfoThrottled = false
  /**
   * Не больше одного текста от клиента за столько мс (прошивка 2.7 — 2000).
   * 0 — без лимита. Лишний текст: queueStatus res=0 и NAK RATE_LIMIT на `from`.
   */
  rateLimitMs = 0
  /** Ретранслировать чужие ЛС (отправитель услышит — неявное подтверждение). */
  relays = false
  /** Часы, выставленные клиентом (set_time_only), секунды. */
  clock = 0
  /** Сколько раз перезагружалось. */
  reboots = 0
  /** Что клиент прислал (ToRadio). */
  readonly received: Mesh.ToRadio[] = []

  private phone: ((bytes: Uint8Array) => void) | null = null
  private closeLink: ((reason: CloseReason) => void) | null = null
  private configured = false
  private readonly queued: Uint8Array[] = []
  /** На какие свои пакеты уже пришёл ответ (ACK или NAK). */
  private readonly answered = new Set<number>()
  private lastTextAt = 0
  private idSeq = 1000

  constructor(
    private readonly air: FakeMeshAir,
    init: FakeDeviceInit
  ) {
    this.nodeNum = init.nodeNum ?? ++nextNodeNum
    const hex = this.nodeNum.toString(16).padStart(8, '0')
    this.user = create(Mesh.UserSchema, {
      id: `!${hex}`,
      longName: init.longName,
      shortName: init.shortName ?? init.longName.slice(0, 4),
      hwModel: Mesh.HardwareModel.HELTEC_V3,
      publicKey: init.noPki ? new Uint8Array(0) : crypto.getRandomValues(new Uint8Array(32)),
    })
    this.lora = create(Config.Config_LoRaConfigSchema, {
      usePreset: true,
      modemPreset: Config.Config_LoRaConfig_ModemPreset.LONG_FAST,
      region: init.region ?? Config.Config_LoRaConfig_RegionCode.RU,
      hopLimit: 3,
      txEnabled: true,
      txPower: 20,
    })
    this.channels = Array.from({ length: 8 }, (_, index) =>
      create(Channel.ChannelSchema, {
        index,
        role: index === 0 ? Channel.Channel_Role.PRIMARY : Channel.Channel_Role.DISABLED,
        settings:
          index === 0
            ? { psk: new Uint8Array([1]), name: '' }
            : { psk: new Uint8Array(0), name: '' },
      })
    )
    air.devices.add(this)
  }

  get hasPki(): boolean {
    return this.user.publicKey.length === 32
  }

  /** Узнать другой узел (как будто слышали его NodeInfo). */
  learn(other: FakeMeshtasticDevice): void {
    this.nodeDb.set(
      other.nodeNum,
      create(Mesh.NodeInfoSchema, {
        num: other.nodeNum,
        user: other.user,
        lastHeard: Math.floor(Date.now() / 1000),
        hopsAway: 0,
      })
    )
  }

  /** Узнать номер узла без имени и ключа (слышали его пакет). */
  hearOf(num: number): void {
    if (!this.nodeDb.has(num)) {
      this.nodeDb.set(
        num,
        create(Mesh.NodeInfoSchema, { num, lastHeard: Math.floor(Date.now() / 1000) })
      )
    }
  }

  /** Подключить клиента: соединение в памяти вместо транспорта. */
  connect(label = 'fake'): PacketLink {
    const packetCbs = new Set<(p: Uint8Array) => void>()
    const closeCbs = new Set<(r: CloseReason) => void>()
    let closed = false
    this.phone = (bytes) => {
      queueMicrotask(() => {
        if (!closed) for (const cb of [...packetCbs]) cb(bytes)
      })
    }
    this.configured = false
    const markClosed = (reason: CloseReason): void => {
      if (closed) return
      closed = true
      this.phone = null
      this.configured = false
      for (const cb of [...closeCbs]) cb(reason)
    }
    this.closeLink = markClosed
    const on = <T>(set: Set<T>, cb: T): Unsubscribe => {
      set.add(cb)
      return () => set.delete(cb)
    }
    return {
      kind: 'tcp',
      label,
      send: async (bytes) => {
        if (closed) throw new Error('link_not_found: closed')
        queueMicrotask(() => this.fromClient(bytes))
      },
      onPacket: (cb) => on(packetCbs, cb),
      onText: () => () => {},
      onClose: (cb) => on(closeCbs, cb),
      wake: async () => {},
      close: async () => {
        closed = true
        this.phone = null
        this.configured = false
      },
    }
  }

  /** Оборвать соединение (кабель, питание). */
  drop(reason = 'device_lost'): void {
    this.closeLink?.(reason)
  }

  // ─── Клиент → радио ─────────────────────────────────────────────────────

  private toPhone(init: FromRadioInit): void {
    const bytes = toBinary(Mesh.FromRadioSchema, create(Mesh.FromRadioSchema, init))
    if (this.phone && this.configured) this.phone(bytes)
    else if (init.payloadVariant?.case === 'packet') this.queued.push(bytes)
  }

  private toPhoneNow(init: FromRadioInit): void {
    const bytes = toBinary(Mesh.FromRadioSchema, create(Mesh.FromRadioSchema, init))
    this.phone?.(bytes)
  }

  private fromClient(bytes: Uint8Array): void {
    const msg = fromBinary(Mesh.ToRadioSchema, bytes)
    this.received.push(msg)
    const v = msg.payloadVariant
    if (v.case === 'wantConfigId') this.sendConfig(v.value)
    else if (v.case === 'packet') this.handleClientPacket(v.value)
    else if (v.case === 'disconnect') this.configured = false
  }

  private sendConfig(nonce: number): void {
    const send = (init: FromRadioInit) => this.toPhoneNow(init)
    send({
      payloadVariant: {
        case: 'myInfo',
        value: { myNodeNum: this.nodeNum, minAppVersion: 30200, nodedbCount: this.nodeDb.size + 1 },
      },
    })
    send({
      payloadVariant: {
        case: 'nodeInfo',
        value: { num: this.nodeNum, user: this.user, isFavorite: true },
      },
    })
    send({
      payloadVariant: {
        case: 'metadata',
        value: {
          firmwareVersion: '2.7.26.54e0d8d',
          hwModel: this.user.hwModel,
          hasBluetooth: true,
          hasPKC: this.hasPki,
        },
      },
    })
    for (const c of this.channels) send({ payloadVariant: { case: 'channel', value: c } })
    send({
      payloadVariant: {
        case: 'config',
        value: { payloadVariant: { case: 'device', value: { nodeInfoBroadcastSecs: 10800 } } },
      },
    })
    send({
      payloadVariant: {
        case: 'config',
        value: { payloadVariant: { case: 'lora', value: this.lora } },
      },
    })
    for (const n of this.nodeDb.values()) send({ payloadVariant: { case: 'nodeInfo', value: n } })
    send({ payloadVariant: { case: 'configCompleteId', value: nonce } })
    send({ payloadVariant: { case: 'queueStatus', value: { free: 16, maxlen: 16 } } })
    this.configured = true
    for (const bytes of this.queued.splice(0)) this.phone?.(bytes)
  }

  private queueStatus(id: number, res = 0): void {
    this.toPhone({
      payloadVariant: {
        case: 'queueStatus',
        value: { res, free: 15, maxlen: 16, meshPacketId: id },
      },
    })
  }

  /** Отказ отправлять: queueStatus с кодом ошибки и NAK от себя, как у прошивки. */
  private refuse(id: number, error: Mesh.Routing_Error): void {
    this.queueStatus(id, error)
    this.routingToPhone(this.nodeNum, id, error)
  }

  /** ЛС, которое прошивка не отправит (queueStatus тогда уходит с ошибкой). */
  private refusesDm(p: Mesh.MeshPacket): boolean {
    if (!this.hasPki) return p.pkiEncrypted
    const peerKey = this.nodeDb.get(p.to >>> 0)?.user?.publicKey ?? new Uint8Array(0)
    if (peerKey.length !== 32) return true
    return p.pkiEncrypted && p.publicKey.length === 32 && !sameBytes(p.publicKey, peerKey)
  }

  private routingToPhone(from: number, requestId: number, error: Mesh.Routing_Error): void {
    this.toPhone({
      payloadVariant: {
        case: 'packet',
        value: {
          from,
          to: this.nodeNum,
          id: ++this.idSeq,
          payloadVariant: {
            case: 'decoded',
            value: {
              portnum: PortNum.ROUTING_APP,
              requestId,
              payload: toBinary(
                Mesh.RoutingSchema,
                create(Mesh.RoutingSchema, { variant: { case: 'errorReason', value: error } })
              ),
            },
          },
        },
      },
    })
  }

  private channelKey(index: number): { name: string; key: string } | null {
    const c = this.channels[index]
    if (!c || c.role === Channel.Channel_Role.DISABLED) return null
    const presetName = 'LongFast'
    return keyOf(c.settings?.name || presetName, c.settings?.psk ?? new Uint8Array(0))
  }

  private handleClientPacket(p: Mesh.MeshPacket): void {
    const id = p.id || ++this.idSeq
    const d = p.payloadVariant.case === 'decoded' ? p.payloadVariant.value : null
    if (!d) return
    if (d.portnum === PortNum.TEXT_MESSAGE_APP && this.rateLimitMs > 0) {
      const now = Date.now()
      if (now - this.lastTextAt < this.rateLimitMs) {
        // MeshService.cpp: пакет выброшен, NAK — на `from` как его прислал клиент.
        this.queueStatus(id)
        if (p.from === this.nodeNum)
          this.routingToPhone(this.nodeNum, id, RoutingError.RATE_LIMIT_EXCEEDED)
        return
      }
      this.lastTextAt = now
    }
    if (
      d.portnum === PortNum.TEXT_MESSAGE_APP &&
      this.lora.region === Config.Config_LoRaConfig_RegionCode.UNSET
    ) {
      // Регион не выбран: передатчик выключен, только res=34 (RadioLibInterface.cpp).
      this.queueStatus(id, 34)
      return
    }
    if (!(p.to !== BROADCAST_NUM && d.portnum === PortNum.TEXT_MESSAGE_APP && this.refusesDm(p))) {
      this.queueStatus(id)
    }
    if (p.to === this.nodeNum && d.portnum === PortNum.ADMIN_APP) {
      this.handleAdmin(id, d)
      return
    }
    const hop = p.hopLimit || this.lora.hopLimit
    const air: AirPacket = {
      from: this.nodeNum,
      to: p.to >>> 0,
      id,
      channel: this.channelKey(p.channel),
      pki: false,
      portnum: d.portnum,
      payload: d.payload,
      wantResponse: d.wantResponse,
      wantAck: p.wantAck,
      requestId: d.requestId,
      replyId: d.replyId,
      emoji: d.emoji,
      hopStart: hop,
      hopLimit: hop,
    }
    if (air.to !== BROADCAST_NUM && d.portnum === PortNum.TEXT_MESSAGE_APP) {
      const peer = this.nodeDb.get(air.to)
      const peerKey = peer?.user?.publicKey ?? new Uint8Array(0)
      if (this.hasPki) {
        // 2.7: ЛС только с PKI; ключа нет — отказ (Router.cpp, perhapsEncode).
        const error =
          peerKey.length !== 32
            ? RoutingError.PKI_SEND_FAIL_PUBLIC_KEY
            : p.pkiEncrypted && p.publicKey.length === 32 && !sameBytes(p.publicKey, peerKey)
              ? RoutingError.PKI_FAILED
              : RoutingError.NONE
        if (error !== RoutingError.NONE) {
          this.refuse(id, error)
          return
        }
        air.pki = true
        air.channel = null
      } else if (p.pkiEncrypted) {
        this.refuse(id, RoutingError.PKI_FAILED)
        return
      }
    }
    if (this.lora.region === Config.Config_LoRaConfig_RegionCode.UNSET) return // молчит
    const heard = this.air.transmit(this, air)
    if (!p.wantAck) return
    if (air.to === BROADCAST_NUM) {
      // Кто-то услышал и ретранслировал — неявное подтверждение от себя.
      queueMicrotask(() =>
        this.routingToPhone(
          this.nodeNum,
          id,
          heard > 0 ? RoutingError.NONE : RoutingError.MAX_RETRANSMIT
        )
      )
    } else if (heard === 0 && !this.answered.has(id)) {
      // Никто не ответил (и не отказал) — радио исчерпало повторы.
      queueMicrotask(() => this.routingToPhone(this.nodeNum, id, RoutingError.MAX_RETRANSMIT))
    }
  }

  private handleAdmin(id: number, d: Mesh.Data): void {
    const a = fromBinary(Admin.AdminMessageSchema, d.payload)
    const v = a.payloadVariant
    let reboot = false
    if (v.case === 'setOwner') {
      this.user = create(Mesh.UserSchema, {
        ...this.user,
        longName: v.value.longName,
        shortName: v.value.shortName,
      })
    } else if (v.case === 'setConfig' && v.value.payloadVariant.case === 'lora') {
      const next = v.value.payloadVariant.value
      reboot = next.region !== this.lora.region || next.modemPreset !== this.lora.modemPreset
      this.lora = next
    } else if (v.case === 'setChannel') {
      this.channels[v.value.index] = v.value
    } else if (v.case === 'removeByNodenum') {
      this.nodeDb.delete(v.value)
    } else if (v.case === 'setTimeOnly') {
      this.clock = v.value
    } else if (v.case === 'addContact') {
      const c = v.value
      if (c.user) {
        const prev = this.nodeDb.get(c.nodeNum)
        this.nodeDb.set(
          c.nodeNum,
          prev
            ? { ...prev, user: c.user, isFavorite: true }
            : create(Mesh.NodeInfoSchema, { num: c.nodeNum, user: c.user, isFavorite: true })
        )
      }
    } else if (v.case === 'getOwnerRequest') {
      this.toPhone({
        payloadVariant: {
          case: 'packet',
          value: {
            from: this.nodeNum,
            to: this.nodeNum,
            id: ++this.idSeq,
            payloadVariant: {
              case: 'decoded',
              value: {
                portnum: PortNum.ADMIN_APP,
                requestId: id,
                payload: toBinary(
                  Admin.AdminMessageSchema,
                  create(Admin.AdminMessageSchema, {
                    payloadVariant: { case: 'getOwnerResponse', value: this.user },
                  })
                ),
              },
            },
          },
        },
      })
      return
    }
    this.routingToPhone(this.nodeNum, id, RoutingError.NONE)
    if (reboot) {
      this.reboots++
      setTimeout(() => this.drop('device_lost'), 0)
    }
  }

  // ─── Эфир → радио ───────────────────────────────────────────────────────

  /** Пакет из эфира. true — узел его принял (расшифровал). */
  hearFromAir(p: AirPacket): boolean {
    if (this.lora.region === Config.Config_LoRaConfig_RegionCode.UNSET) return false
    const forMe = p.to === this.nodeNum
    if (p.to !== BROADCAST_NUM && !forMe) {
      // Чужая ЛС: ретранслятор передаёт её дальше, отправитель это слышит.
      if (this.relays && p.portnum === PortNum.TEXT_MESSAGE_APP)
        this.air.byNum(p.from)?.heardRelay(p.id)
      return false
    }
    let channelIndex = 0
    if (p.pki) {
      if (!forMe || !this.hasPki) return false
    } else {
      const found = this.channels.findIndex((_c, i) => {
        const k = this.channelKey(i)
        return (
          k !== null && p.channel !== null && k.key === p.channel.key && k.name === p.channel.name
        )
      })
      if (found === -1) {
        if (forMe && p.wantAck) this.air.transmit(this, this.routing(p, RoutingError.NO_CHANNEL))
        return false
      }
      channelIndex = found
      // Прошивка 2.6+ не принимает ЛС без PKI.
      if (forMe && p.portnum === PortNum.TEXT_MESSAGE_APP && this.hasPki) {
        if (p.wantAck) this.air.transmit(this, this.routing(p, RoutingError.NO_CHANNEL))
        return false
      }
    }
    this.hearOf(p.from)
    if (p.portnum === PortNum.NODEINFO_APP) {
      const user = fromBinary(Mesh.UserSchema, p.payload)
      const prev = this.nodeDb.get(p.from)
      this.nodeDb.set(
        p.from,
        prev ? { ...prev, user } : create(Mesh.NodeInfoSchema, { num: p.from, user })
      )
      if (p.wantResponse && forMe && !this.nodeInfoThrottled) {
        this.air.transmit(this, {
          ...this.blank(p.from),
          portnum: PortNum.NODEINFO_APP,
          payload: toBinary(Mesh.UserSchema, this.user),
          channel: this.channelKey(0),
        })
      }
    }
    if (p.portnum === PortNum.ROUTING_APP) {
      if (forMe) {
        this.answered.add(p.requestId)
        this.routingToPhone(p.from, p.requestId, this.routingError(p.payload))
      }
      return true
    }
    this.toPhone({
      payloadVariant: {
        case: 'packet',
        value: {
          from: p.from,
          to: p.to,
          id: p.id,
          channel: p.pki ? 0 : channelIndex,
          hopStart: p.hopStart,
          hopLimit: p.hopLimit,
          rxTime: Math.floor(Date.now() / 1000),
          rxSnr: 6.5,
          pkiEncrypted: p.pki,
          payloadVariant: {
            case: 'decoded',
            value: {
              portnum: p.portnum,
              payload: p.payload,
              wantResponse: p.wantResponse,
              requestId: p.requestId,
              replyId: p.replyId,
              emoji: p.emoji,
            },
          },
        },
      },
    })
    if (forMe && p.wantAck) this.air.transmit(this, this.routing(p, RoutingError.NONE))
    return true
  }

  /** Услышали ретрансляцию своего пакета: неявное подтверждение, повторы кончились. */
  heardRelay(id: number): void {
    if (this.answered.has(id)) return
    this.answered.add(id)
    this.routingToPhone(this.nodeNum, id, RoutingError.NONE)
  }

  private blank(to: number): AirPacket {
    return {
      from: this.nodeNum,
      to,
      id: ++this.idSeq,
      channel: this.channelKey(0),
      pki: false,
      portnum: 0,
      payload: new Uint8Array(0),
      wantResponse: false,
      wantAck: false,
      requestId: 0,
      replyId: 0,
      emoji: 0,
      hopStart: 3,
      hopLimit: 3,
    }
  }

  private routing(p: AirPacket, error: Mesh.Routing_Error): AirPacket {
    return {
      ...this.blank(p.from),
      portnum: PortNum.ROUTING_APP,
      requestId: p.id,
      payload: toBinary(
        Mesh.RoutingSchema,
        create(Mesh.RoutingSchema, { variant: { case: 'errorReason', value: error } })
      ),
    }
  }

  private routingError(payload: Uint8Array): Mesh.Routing_Error {
    const r = fromBinary(Mesh.RoutingSchema, payload)
    return r.variant.case === 'errorReason' ? r.variant.value : RoutingError.NONE
  }

  /** Узел пишет в эфир сам (как будто с другого клиента): текст в канал или ЛС. */
  sendTextFromHere(
    to: number | 'broadcast',
    text: string,
    extra: { replyId?: number; emoji?: boolean } = {}
  ): number {
    const target = to === 'broadcast' ? BROADCAST_NUM : to
    const peer = target === BROADCAST_NUM ? undefined : this.nodeDb.get(target)
    const pki =
      target !== BROADCAST_NUM && this.hasPki && (peer?.user?.publicKey.length ?? 0) === 32
    const id = ++this.idSeq
    this.air.transmit(this, {
      ...this.blank(target),
      id,
      pki,
      channel: pki ? null : this.channelKey(0),
      portnum: PortNum.TEXT_MESSAGE_APP,
      payload: new TextEncoder().encode(text),
      wantAck: true,
      replyId: extra.replyId ?? 0,
      emoji: extra.emoji ? 1 : 0,
    })
    return id
  }

  /** Добавить канал на радио (как будто с другого клиента). */
  setChannel(index: number, name: string, psk: Uint8Array): void {
    this.channels[index] = create(Channel.ChannelSchema, {
      index,
      role: index === 0 ? Channel.Channel_Role.PRIMARY : Channel.Channel_Role.SECONDARY,
      settings: { name, psk },
    })
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}
