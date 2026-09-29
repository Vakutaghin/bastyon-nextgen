/**
 * Сеанс с радио Meshtastic: свой узел, узлы сети, каналы, переписка.
 *
 * Как устроена доставка (прошивка 2.7, src/mesh/ReliableRouter.cpp):
 * - пакет с `want_ack` радио само повторяет, пока не получит подтверждение;
 * - о судьбе пакета радио сообщает Routing-пакетом с `request_id` = id
 *   пакета: ошибка NONE от получателя — дошло; NONE от себя — «неявное»
 *   подтверждение, кто-то ретранслировал (для канала это и есть лучший знак);
 *   любая другая ошибка — не дошло;
 * - `queueStatus` с id пакета — радио взяло его в очередь на отправку.
 *
 * ЛС с 2.5 шифруются ключами узлов (PKI), и прошивка 2.6+ отбрасывает ЛС без
 * такого шифрования («legacy DM»). Ключ получателя радио узнаёт из его
 * NodeInfo, поэтому перед первым ЛС узлу без ключа сеанс просит NodeInfo.
 */

import type { CloseReason, Unsubscribe } from '../radio/types'
import { MeshtasticClient, MeshtasticError, type ClientOptions } from './client'
import {
  decodeAdmin,
  decodeDeviceMetrics,
  decodePosition,
  decodeRoutingError,
  decodeUser,
  encodeAdminPayload,
  encodeChannelUrl,
  encodeUser,
  fromHex,
  isBroadcast,
  nodeIdOf,
  PortNum,
  rawChannelSettings,
  rawLoRa,
  rawUser,
  RoutingError,
  userFromRaw,
  type AdminInit,
  type ChannelSetShare,
  type PacketInit,
  type MtChannel,
  type MtLoRa,
  type MtMetadata,
  type MtNode,
  type MtPacket,
  type RawLoRaConfig,
  type RawUser,
} from './codec'
import { BROADCAST_NUM, CHANNEL_SLOTS, REGION_UNSET } from './constants'
import type { PacketLink } from './framing'
import {
  channelIdOf,
  channelKindOf,
  displayChannelName,
  effectivePsk,
  isUnencrypted,
} from './channels'

export interface MtSelf {
  nodeNum: number
  /** `!a1b2c3d4`. */
  id: string
  longName: string
  shortName: string
  publicKey: string | null
  hwModelName: string | null
}

export interface MtSessionChannel {
  index: number
  role: 'primary' | 'secondary'
  /** Имя для показа (пустое у основного — имя пресета). */
  name: string
  /** Имя как записано на радио. */
  rawName: string
  psk: Uint8Array
  /** Постоянный id для диалога: хэш имени и ключа. */
  id: string
  kind: 'public' | 'private'
  unencrypted: boolean
}

interface IncomingBase {
  from: number
  fromName: string | null
  /** Открытый ключ отправителя, если радио его знает. */
  fromKey: string | null
  packetId: number
  text: string
  /** Время приёма, секунды (по часам радио или своим). */
  rxTime: number
  snr: number | null
  rssi: number | null
  hops: number | null
  viaMqtt: boolean
  /** Ответ на пакет с этим id. */
  replyId: number | null
  /** Реакция: text — эмодзи, replyId — на что. */
  reaction: boolean
}

export type MtIncoming =
  | (IncomingBase & { kind: 'direct'; pki: boolean })
  | (IncomingBase & { kind: 'channel'; channel: MtSessionChannel })

export type MtSendStatus = 'sent' | 'delivered' | 'failed'

export interface MtSendUpdate {
  status: MtSendStatus
  error?: string
  /** Кто-то ретранслировал, но получатель ещё не подтвердил. */
  relayed?: boolean
  /** Id пакета в эфире (меняется, если прошивка отбросила текст по лимиту и он ушёл заново). */
  packetId?: number
}

export type MtTarget = { kind: 'direct'; num: number } | { kind: 'channel'; index: number }

/** Что приложение знает о собеседнике сверх базы радио (база радио бывает меньше). */
export interface MtPeer {
  publicKey: string
  longName?: string
  shortName?: string
}

export interface SessionEvents {
  message: (m: MtIncoming) => void
  nodes: () => void
  channels: () => void
  config: () => void
  self: () => void
  battery: (level: number | null, voltage: number | null) => void
  notification: (text: string) => void
  closed: (reason: CloseReason) => void
}

type Listeners = { [K in keyof SessionEvents]: Set<SessionEvents[K]> }

export interface MtSessionOptions extends ClientOptions {
  /** Ждать подтверждения ЛС не дольше, мс. */
  ackTimeoutMs?: number
  /** Ждать итога сообщения в канал не дольше, мс. */
  channelTimeoutMs?: number
  /** Ждать ключ узла после запроса NodeInfo, мс. */
  keyWaitMs?: number
  /** Ждать ответа admin, мс. */
  adminTimeoutMs?: number
  /**
   * Пауза между текстами, мс. Прошивка 2.7 принимает не больше одного текста
   * за 2 с на соединение, лишние выбрасывает (MeshService.cpp).
   */
  textSpacingMs?: number
  /** Сколько ждать настоящий ACK после ретрансляции ЛС, мс. */
  relayedWaitMs?: number
  /** Выставить часы радио при подключении (у радио без GPS их нет). */
  setClock?: boolean
}

interface Pending {
  target: MtTarget
  onUpdate: (u: MtSendUpdate) => void
  timer: ReturnType<typeof setTimeout> | null
  queued: boolean
  relayed?: boolean
  final: boolean
  /** Пакет без id — чтобы переотправить после отказа по лимиту частоты. */
  packet: Omit<PacketInit, 'id'>
  /** Сколько раз уже переотправляли. */
  resent: number
}

/** Ошибки Routing, которые значат «не ушло вовсе», а не «никто не ответил». */
const HARD_ERRORS = new Set<number>([
  RoutingError.NO_CHANNEL,
  RoutingError.TOO_LARGE,
  RoutingError.NO_INTERFACE,
  RoutingError.DUTY_CYCLE_LIMIT,
  RoutingError.RATE_LIMIT_EXCEEDED,
  RoutingError.PKI_FAILED,
  RoutingError.PKI_UNKNOWN_PUBKEY,
  RoutingError.PKI_SEND_FAIL_PUBLIC_KEY,
  RoutingError.BAD_REQUEST,
  RoutingError.NOT_AUTHORIZED,
])

/**
 * Код отказа из queueStatus.res, если NAK не пришёл: 32 — очередь полна,
 * 33 — нет радиоинтерфейса, 34 — передатчик выключен или регион не выбран.
 */
export function queueErrorCode(res: number): string {
  if (res === 32) return 'queue_full'
  if (res === 33 || res === 34) return 'radio_off'
  return routingErrorCode(res)
}

/** Код ошибки для интерфейса (`mesh.errors.<код>`). */
export function routingErrorCode(error: number): string {
  switch (error) {
    case RoutingError.MAX_RETRANSMIT:
    case RoutingError.TIMEOUT:
    case RoutingError.NO_RESPONSE:
      return 'no_ack'
    case RoutingError.NO_ROUTE:
    case RoutingError.GOT_NAK:
      return 'no_route'
    case RoutingError.NO_CHANNEL:
    case RoutingError.PKI_UNKNOWN_PUBKEY:
    case RoutingError.PKI_FAILED:
    case RoutingError.PKI_SEND_FAIL_PUBLIC_KEY:
      return 'no_key'
    case RoutingError.TOO_LARGE:
      return 'too_long'
    case RoutingError.DUTY_CYCLE_LIMIT:
    case RoutingError.RATE_LIMIT_EXCEEDED:
      return 'air_limit'
    case RoutingError.NO_INTERFACE:
      return 'radio_off'
    default:
      return 'send_failed'
  }
}

function randomPacketId(): number {
  const v = crypto.getRandomValues(new Uint32Array(1))[0]!
  return v === 0 ? 1 : v
}

export class MeshtasticSession {
  private readonly listeners: Listeners = {
    message: new Set(),
    nodes: new Set(),
    channels: new Set(),
    config: new Set(),
    self: new Set(),
    battery: new Set(),
    notification: new Set(),
    closed: new Set(),
  }
  private readonly pending = new Map<number, Pending>()
  /** Ответы admin и NodeInfo: id запроса → ожидающий. */
  private readonly waiters = new Map<number, (p: MtPacket) => void>()
  /** Входящие до `ready`: радио отдаёт накопленное сразу после рукопожатия. */
  private backlog: MtPacket[] = []
  private ready = false
  private closedFlag = false
  private closeReason: CloseReason = null
  private readonly opts: Required<
    Pick<
      MtSessionOptions,
      | 'ackTimeoutMs'
      | 'channelTimeoutMs'
      | 'keyWaitMs'
      | 'adminTimeoutMs'
      | 'textSpacingMs'
      | 'relayedWaitMs'
      | 'setClock'
    >
  >
  /** Очередь текстов: следующий не раньше чем через textSpacingMs. */
  private textGate: Promise<void> = Promise.resolve()
  private adminChain: Promise<unknown> = Promise.resolve()
  private lastTextAt = 0

  self!: MtSelf
  metadata: MtMetadata | null = null
  lora: MtLoRa | null = null
  readonly nodes = new Map<number, MtNode>()
  channels: MtSessionChannel[] = []
  private rawChannels: MtChannel[] = []
  private selfUser: RawUser | null = null
  private loraRaw: RawLoRaConfig | null = null

  private constructor(
    private readonly client: MeshtasticClient,
    opts: MtSessionOptions
  ) {
    this.opts = {
      ackTimeoutMs: opts.ackTimeoutMs ?? 180_000,
      channelTimeoutMs: opts.channelTimeoutMs ?? 90_000,
      keyWaitMs: opts.keyWaitMs ?? 20_000,
      adminTimeoutMs: opts.adminTimeoutMs ?? 15_000,
      // Лимит прошивки — 2 с по её часам; запас на неровную доставку (TCP, BLE).
      textSpacingMs: opts.textSpacingMs ?? 2_500,
      relayedWaitMs: opts.relayedWaitMs ?? 60_000,
      setClock: opts.setClock ?? true,
    }
    client.on('packet', (p) => {
      if (this.ready) this.handlePacket(p)
      else this.backlog.push(p)
    })
    client.on('queueStatus', (s) => this.handleQueueStatus(s.packetId, s.res))
    client.on('nodeInfo', (node, raw) => this.upsertNode(node, raw))
    client.on('channel', (c) => {
      this.rawChannels[c.index] = c
      void this.rebuildChannels()
    })
    client.on('lora', (lora, raw) => {
      this.lora = lora
      this.loraRaw = raw
      this.emit('config')
      void this.rebuildChannels()
    })
    client.on('notification', (n) => {
      if (n.message) this.emit('notification', n.message)
    })
    client.on('rebooted', () => {
      // Радио перезагрузилось, а порт остался открытым: сеанс начинается заново.
      void this.close('rebooted')
    })
    client.on('closed', (reason) => this.handleClosed(reason))
  }

  static create(link: PacketLink, opts: MtSessionOptions = {}): MeshtasticSession {
    return new MeshtasticSession(new MeshtasticClient(link, opts), opts)
  }

  static async open(link: PacketLink, opts: MtSessionOptions = {}): Promise<MeshtasticSession> {
    const s = MeshtasticSession.create(link, opts)
    await s.start()
    return s
  }

  on<K extends keyof SessionEvents>(event: K, cb: SessionEvents[K]): Unsubscribe {
    this.listeners[event].add(cb)
    return () => this.listeners[event].delete(cb)
  }

  private emit<K extends keyof SessionEvents>(
    event: K,
    ...args: Parameters<SessionEvents[K]>
  ): void {
    for (const cb of [...this.listeners[event]]) {
      ;(cb as (...a: Parameters<SessionEvents[K]>) => void)(...args)
    }
  }

  get isClosed(): boolean {
    return this.closedFlag
  }

  get label(): string {
    return this.client.link.label
  }

  /** Регион не задан: радио ничего не передаёт, пока его не выберут. */
  get regionUnset(): boolean {
    return (this.lora?.region ?? REGION_UNSET) === REGION_UNSET
  }

  /** Рукопожатие; после него приходят накопленные сообщения. */
  async start(): Promise<void> {
    const snap = await this.client.configure()
    const num = snap.myInfo.nodeNum
    for (const [n, node] of snap.nodes) this.nodes.set(n, node)
    this.selfUser = snap.selfUser
    this.metadata = snap.metadata
    this.lora = snap.lora
    this.loraRaw = snap.loraRaw
    this.rawChannels = snap.channels
    this.self = this.selfFrom(num)
    await this.rebuildChannels(false)
    this.ready = true
    const queued = this.backlog
    this.backlog = []
    for (const p of queued) this.handlePacket(p)
    // Как приложение для Android: часы радио без GPS иначе стоят на нуле.
    if (this.opts.setClock) {
      void this.admin({
        payloadVariant: { case: 'setTimeOnly', value: Math.floor(Date.now() / 1000) },
      }).catch(() => {})
    }
  }

  private selfFrom(num: number): MtSelf {
    const user = this.selfUser ? userFromRaw(this.selfUser, num) : this.nodes.get(num)?.user
    return {
      nodeNum: num,
      id: nodeIdOf(num),
      longName: user?.longName ?? '',
      shortName: user?.shortName ?? '',
      publicKey: user?.publicKey ?? null,
      hwModelName: user?.hwModelName ?? this.metadata?.hwModelName ?? null,
    }
  }

  private async rebuildChannels(notify = true): Promise<void> {
    const out: MtSessionChannel[] = []
    const primaryPsk = this.rawChannels.find((c) => c?.role === 'primary')?.psk ?? new Uint8Array(0)
    for (const c of this.rawChannels) {
      if (!c || c.role === 'disabled') continue
      const name = displayChannelName(c, this.lora)
      const key = effectivePsk(c, primaryPsk)
      out.push({
        index: c.index,
        role: c.role,
        name,
        rawName: c.name,
        psk: c.psk,
        id: await channelIdOf(name, key),
        kind: channelKindOf(key),
        unencrypted: isUnencrypted(key),
      })
    }
    this.channels = out
    if (notify) this.emit('channels')
  }

  // ─── Узлы ────────────────────────────────────────────────────────────────

  node(num: number): MtNode | undefined {
    return this.nodes.get(num >>> 0)
  }

  /** Имя узла для людей: длинное, короткое или `!id`. */
  nodeName(num: number): string {
    const u = this.node(num)?.user
    return u?.longName || u?.shortName || nodeIdOf(num)
  }

  private upsertNode(node: MtNode, raw: RawUser | null): void {
    const prev = this.nodes.get(node.num)
    this.nodes.set(node.num, { ...prev, ...node, user: node.user ?? prev?.user ?? null })
    if (this.self && node.num === this.self.nodeNum) {
      if (raw) this.selfUser = raw
      this.self = this.selfFrom(node.num)
      this.emit('self')
    }
    this.emit('nodes')
  }

  private touchNode(p: MtPacket, patch: Partial<MtNode> = {}): void {
    const prev = this.nodes.get(p.from)
    const node: MtNode = {
      num: p.from,
      user: prev?.user ?? null,
      snr: p.rxSnr || prev?.snr || 0,
      lastHeard: p.rxTime || Math.floor(Date.now() / 1000),
      hopsAway: hopsOf(p) ?? prev?.hopsAway ?? null,
      viaMqtt: p.viaMqtt,
      isFavorite: prev?.isFavorite ?? false,
      isIgnored: prev?.isIgnored ?? false,
      channel: prev?.channel ?? p.channel,
      battery: prev?.battery ?? null,
      voltage: prev?.voltage ?? null,
      position: prev?.position ?? null,
      ...patch,
    }
    this.nodes.set(p.from, node)
    this.emit('nodes')
  }

  // ─── Входящие ────────────────────────────────────────────────────────────

  private handlePacket(p: MtPacket): void {
    const d = p.decoded
    if (!d) return
    const me = this.self.nodeNum
    if (d.requestId) {
      const waiter = this.waiters.get(d.requestId)
      if (waiter) waiter(p)
    }
    switch (d.portnum) {
      case PortNum.ROUTING_APP:
        if (d.requestId) this.handleRouting(p, d.requestId)
        return
      case PortNum.TEXT_MESSAGE_APP:
        if (p.from !== me) this.handleText(p)
        return
      case PortNum.NODEINFO_APP: {
        if (p.from === me) return
        try {
          const raw = decodeUser(d.payload)
          this.touchNode(p, { user: userFromRaw(raw, p.from) })
        } catch {
          /* битый NodeInfo — пропускаем */
        }
        return
      }
      case PortNum.POSITION_APP: {
        if (p.from === me) return
        try {
          const position = decodePosition(d.payload)
          if (position) this.touchNode(p, { position })
        } catch {
          /* пропускаем */
        }
        return
      }
      case PortNum.TELEMETRY_APP: {
        try {
          const m = decodeDeviceMetrics(d.payload)
          if (!m) return
          if (p.from === me) this.emit('battery', m.battery, m.voltage)
          else this.touchNode(p, { battery: m.battery, voltage: m.voltage })
        } catch {
          /* пропускаем */
        }
        return
      }
      default:
        return
    }
  }

  private handleText(p: MtPacket): void {
    const d = p.decoded!
    const text = new TextDecoder().decode(d.payload)
    if (!text) return
    this.touchNode(p)
    const base: IncomingBase = {
      from: p.from,
      fromName: this.node(p.from)?.user ? this.nodeName(p.from) : null,
      fromKey: this.node(p.from)?.user?.publicKey ?? null,
      packetId: p.id,
      text,
      rxTime: p.rxTime || Math.floor(Date.now() / 1000),
      snr: p.rxSnr || null,
      rssi: p.rxRssi,
      hops: hopsOf(p),
      viaMqtt: p.viaMqtt,
      replyId: d.replyId || null,
      reaction: d.emoji !== 0 && d.replyId !== 0,
    }
    if (isBroadcast(p.to)) {
      const channel = this.channels.find((c) => c.index === p.channel)
      if (!channel) return
      this.emit('message', { ...base, kind: 'channel', channel })
    } else if (p.to === this.self.nodeNum) {
      this.emit('message', { ...base, kind: 'direct', pki: p.pkiEncrypted })
    }
  }

  // ─── Доставка ────────────────────────────────────────────────────────────

  private handleQueueStatus(packetId: number, res: number): void {
    const pend = this.pending.get(packetId)
    if (!pend || pend.final || pend.queued) return
    // res ≠ 0 — радио не взяло пакет. Коды неоднозначны (32 и 34 — и ошибки
    // очереди, и Routing), точную причину даёт NAK следом; нет NAK — судим по res.
    if (res !== 0) {
      if (pend.timer) clearTimeout(pend.timer)
      pend.timer = setTimeout(
        () => this.settle(packetId, { status: 'failed', error: queueErrorCode(res) }),
        1_500
      )
      return
    }
    pend.queued = true
    pend.onUpdate({ status: 'sent', packetId })
  }

  private handleRouting(p: MtPacket, requestId: number): void {
    const pend = this.pending.get(requestId)
    if (!pend || pend.final) return
    const error = safeRoutingError(p.decoded!.payload)
    if (error === null) return // битый Routing — судьбу пакета из него не узнать
    const me = this.self.nodeNum
    if (error === RoutingError.RATE_LIMIT_EXCEEDED && p.from === me && pend.resent < 3) {
      // Прошивка отбросила текст (чаще раза в 2 с). Тот же id она уже запомнила
      // и повтор проглотит молча — шлём заново с новым.
      this.resend(requestId, pend)
      return
    }
    if (pend.target.kind === 'direct') {
      if (error === RoutingError.NONE) {
        if (p.from === pend.target.num) this.settle(requestId, { status: 'delivered' })
        else if (p.from === me && !pend.relayed) {
          // Неявное подтверждение: кто-то ретранслировал. Радио перестаёт
          // повторять, так что настоящего ACK может не быть — это не ошибка.
          pend.queued = true
          pend.relayed = true
          pend.onUpdate({ status: 'sent', relayed: true, packetId: requestId })
          if (pend.timer) clearTimeout(pend.timer)
          pend.timer = setTimeout(
            () => this.settle(requestId, { status: 'sent', relayed: true }),
            this.opts.relayedWaitMs
          )
        }
        return
      }
      this.settle(requestId, { status: 'failed', error: routingErrorCode(error) })
      return
    }
    // Канал: подтверждения от адресата нет; ретрансляция — лучшее, что бывает.
    if (error === RoutingError.NONE) this.settle(requestId, { status: 'delivered' })
    else if (HARD_ERRORS.has(error)) {
      this.settle(requestId, { status: 'failed', error: routingErrorCode(error) })
    } else this.settle(requestId, { status: 'sent' })
  }

  private settle(packetId: number, update: MtSendUpdate): void {
    const pend = this.pending.get(packetId)
    if (!pend || pend.final) return
    pend.final = true
    if (pend.timer) clearTimeout(pend.timer)
    this.pending.delete(packetId)
    pend.onUpdate({ ...update, packetId })
  }

  private resend(oldId: number, pend: Pending): void {
    this.pending.delete(oldId)
    pend.resent++
    pend.queued = false
    void this.transmitText(pend).catch((e: unknown) => {
      pend.final = true
      if (pend.timer) clearTimeout(pend.timer)
      pend.onUpdate({
        status: 'failed',
        error: e instanceof MeshtasticError ? e.code : 'send_failed',
      })
    })
  }

  /** Отдать текст радио под новым id, соблюдая паузу между текстами. */
  private async transmitText(pend: Pending): Promise<number> {
    await this.waitTextSlot()
    if (this.closedFlag) throw new MeshtasticError('closed')
    const id = randomPacketId()
    this.pending.set(id, pend)
    try {
      await this.client.sendPacket({ ...pend.packet, id })
    } catch (e) {
      this.pending.delete(id)
      throw e
    }
    return id
  }

  /**
   * Отправить текст. Статусы приходят в `onUpdate`: `sent` — радио взяло в
   * эфир, `delivered` — получатель подтвердил (в канале — ретранслировали),
   * `failed` — не дошло. Возвращает id пакета.
   */
  async sendText(
    target: MtTarget,
    text: string,
    onUpdate: (u: MtSendUpdate) => void,
    extra: { replyId?: number; emoji?: boolean; peer?: MtPeer | null } = {}
  ): Promise<number> {
    if (this.closedFlag) throw new MeshtasticError('closed')
    let to = BROADCAST_NUM
    let channel: number
    if (target.kind === 'channel') {
      const ch = this.channels.find((c) => c.index === target.index)
      if (!ch) throw new MeshtasticError('rejected', 'channel_not_found')
      channel = ch.index
    } else {
      to = target.num >>> 0
      // Шифровать ли ключами узлов, решает прошивка: ключ получателя известен —
      // PKI, неизвестен — 2.7 отказывается слать ЛС вовсе (PKI_SEND_FAIL_PUBLIC_KEY).
      // Поэтому сначала пробуем узнать ключ. Флаг pki_encrypted не ставлю: с
      // устаревшим ключом в приложении прошивка ответила бы PKI_FAILED.
      // Ключ знает приложение, но не радио (его база меньше и вытесняет старые
      // узлы) — отдаём ключ радио, как официальные клиенты перед каждым ЛС.
      // Не знает никто — просим NodeInfo у самого узла.
      if (this.metadata?.hasPKC !== false && !this.node(to)?.user?.publicKey) {
        if (extra.peer?.publicKey) await this.addContact(to, extra.peer)
        else await this.requestNodeInfo(to, true)
      }
      channel = this.node(to)?.channel ?? 0
    }
    const pend: Pending = {
      target,
      onUpdate,
      timer: null,
      queued: false,
      final: false,
      resent: 0,
      packet: {
        from: this.self.nodeNum,
        to,
        channel,
        portnum: PortNum.TEXT_MESSAGE_APP,
        payload: new TextEncoder().encode(text),
        wantAck: true,
        hopLimit: this.lora?.hopLimit || 3,
        replyId: extra.replyId,
        emoji: extra.emoji ? 1 : undefined,
      },
    }
    const id = await this.transmitText(pend)
    const timeout = target.kind === 'direct' ? this.opts.ackTimeoutMs : this.opts.channelTimeoutMs
    pend.timer = setTimeout(() => {
      // Радио так и не сообщило итог: для ЛС это «не подтверждено».
      const current = [...this.pending.entries()].find(([, v]) => v === pend)?.[0] ?? id
      this.settle(
        current,
        target.kind === 'direct' ? { status: 'failed', error: 'no_ack' } : { status: 'sent' }
      )
    }, timeout)
    return id
  }

  /** Дождаться своей очереди: тексты уходят не чаще раза в textSpacingMs. */
  private waitTextSlot(): Promise<void> {
    const turn = this.textGate.then(async () => {
      const wait = this.lastTextAt + this.opts.textSpacingMs - Date.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      this.lastTextAt = Date.now()
    })
    this.textGate = turn.catch(() => {})
    return turn
  }

  /**
   * Попросить у узла его NodeInfo (имя и ключ), отдав свой. Прошивка отвечает
   * на такие просьбы не чаще раза в 10 минут, поэтому ответа может не быть.
   * `wait` — дождаться ключа (или таймаута).
   */
  async requestNodeInfo(num: number, wait = false): Promise<boolean> {
    if (!this.selfUser || isBroadcast(num) || num === this.self.nodeNum) return false
    const node = this.node(num)
    const id = randomPacketId()
    const got = wait ? this.waitForKey(num) : null
    await this.client.sendPacket({
      from: this.self.nodeNum,
      to: num,
      id,
      channel: node?.channel ?? 0,
      portnum: PortNum.NODEINFO_APP,
      payload: encodeUser(this.selfUser),
      wantResponse: true,
      hopLimit: this.lora?.hopLimit || 3,
    })
    return got ? got : true
  }

  private waitForKey(num: number): Promise<boolean> {
    return new Promise((resolve) => {
      const check = (): boolean => !!this.node(num)?.user?.publicKey
      if (check()) return resolve(true)
      const stop = this.on('nodes', () => {
        if (check()) {
          clearTimeout(timer)
          stop()
          resolve(true)
        }
      })
      const timer = setTimeout(() => {
        stop()
        resolve(false)
      }, this.opts.keyWaitMs)
    })
  }

  // ─── Настройки радио (admin своему узлу) ─────────────────────────────────

  /**
   * Команда своему узлу; ждёт Routing-ответа прошивки. Команды идут строго по
   * одной: очередь локальных пакетов у прошивки короткая, и пачка команд
   * вытесняет первые («fromRadioQ full, drop oldest»).
   */
  private admin(message: AdminInit, expectResponse = false): Promise<MtPacket | null> {
    const run = this.adminChain.then(() => this.adminNow(message, expectResponse))
    this.adminChain = run.catch(() => null)
    return run
  }

  private async adminNow(message: AdminInit, expectResponse: boolean): Promise<MtPacket | null> {
    if (this.closedFlag) throw new MeshtasticError('closed')
    const id = randomPacketId()
    const reply = new Promise<MtPacket | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(id)
        if (expectResponse) reject(new MeshtasticError('timeout'))
        else resolve(null)
      }, this.opts.adminTimeoutMs)
      this.waiters.set(id, (p) => {
        const d = p.decoded
        if (!d) return
        if (d.portnum === PortNum.ROUTING_APP) {
          const err = safeRoutingError(d.payload)
          if (err !== RoutingError.NONE) {
            clearTimeout(timer)
            this.waiters.delete(id)
            reject(new MeshtasticError('rejected', routingErrorCode(err ?? -1)))
            return
          }
          if (expectResponse) return // ждём сам ответ admin
        }
        clearTimeout(timer)
        this.waiters.delete(id)
        resolve(p)
      })
    })
    await this.client.sendPacket({
      to: this.self.nodeNum,
      id,
      channel: 0,
      portnum: PortNum.ADMIN_APP,
      payload: encodeAdminPayload(message),
      wantResponse: true,
    })
    return reply
  }

  /**
   * Имя узла: длинное (до 39 байт) и короткое (до 4). Прошивка после смены
   * имени перезагружается через 7 с (AdminModule.cpp) — соединение
   * восстановится само.
   */
  async setOwner(longName: string, shortName: string): Promise<void> {
    if (!this.selfUser) throw new MeshtasticError('rejected', 'no_owner')
    const user = rawUser(this.selfUser, { longName, shortName })
    await this.admin({ payloadVariant: { case: 'setOwner', value: user } })
    this.selfUser = user
    this.self = this.selfFrom(this.self.nodeNum)
    const node = this.nodes.get(this.self.nodeNum)
    if (node) this.nodes.set(node.num, { ...node, user: userFromRaw(user, node.num) })
    this.emit('self')
    this.emit('nodes')
  }

  /**
   * Регион, пресет и число хопов. Смена региона или пресета перезагружает
   * радио — сеанс закроется, и соединение восстановится само.
   */
  async setLoRa(
    patch: Partial<Pick<MtLoRa, 'region' | 'modemPreset' | 'hopLimit'>>
  ): Promise<boolean> {
    if (!this.loraRaw) throw new MeshtasticError('rejected', 'no_config')
    const next = rawLoRa(this.loraRaw, {
      ...patch,
      usePreset: patch.modemPreset !== undefined ? true : this.loraRaw.usePreset,
      txEnabled: true,
    })
    const reboots =
      (patch.region !== undefined && patch.region !== this.loraRaw.region) ||
      (patch.modemPreset !== undefined && patch.modemPreset !== this.loraRaw.modemPreset)
    await this.admin({
      payloadVariant: {
        case: 'setConfig',
        value: { payloadVariant: { case: 'lora', value: next } },
      },
    })
    this.loraRaw = next
    this.lora = { ...(this.lora as MtLoRa), ...patch }
    this.emit('config')
    await this.rebuildChannels()
    return reboots
  }

  /** Добавить канал в первый свободный слот. Возвращает номер слота. */
  async addChannel(name: string, psk: Uint8Array): Promise<number> {
    const used = new Set(this.channels.map((c) => c.index))
    let index = -1
    for (let i = 1; i < CHANNEL_SLOTS; i++) {
      if (!used.has(i)) {
        index = i
        break
      }
    }
    if (index === -1) throw new MeshtasticError('rejected', 'channels_full')
    await this.writeChannel(index, 'secondary', name, psk)
    return index
  }

  /** Убрать дополнительный канал. Основной убрать нельзя. */
  async removeChannel(index: number): Promise<void> {
    if (index <= 0) throw new MeshtasticError('rejected', 'primary_channel')
    await this.writeChannel(index, 'disabled', '', new Uint8Array(0))
  }

  private async writeChannel(
    index: number,
    role: 'primary' | 'secondary' | 'disabled',
    name: string,
    psk: Uint8Array
  ): Promise<void> {
    const roleCode = role === 'primary' ? 1 : role === 'secondary' ? 2 : 0
    await this.admin({
      payloadVariant: {
        case: 'setChannel',
        value: { index, role: roleCode, settings: rawChannelSettings(name, psk) },
      },
    })
    this.rawChannels[index] = {
      index,
      role,
      name,
      psk,
      uplinkEnabled: false,
      downlinkEnabled: false,
      positionPrecision: 0,
      muted: false,
    }
    await this.rebuildChannels()
  }

  /** Добавить каналы из ссылки; уже известные пропускаются. */
  async importChannels(share: ChannelSetShare): Promise<number[]> {
    const added: number[] = []
    for (const c of share.channels) {
      // Безымянный канал в ссылке — чей-то основной: имя ему даёт пресет.
      const name = c.name || displayChannelName({ index: 0, name: '', role: 'primary' }, this.lora)
      const id = await channelIdOf(name, c.psk)
      if (this.channels.some((x) => x.id === id)) continue
      added.push(await this.addChannel(c.name, c.psk))
    }
    return added
  }

  /** Ссылка на канал для приглашения (с настройками радио, как у официальных приложений). */
  channelUrl(index: number): string | null {
    const ch = this.channels.find((c) => c.index === index)
    if (!ch) return null
    return encodeChannelUrl([{ name: ch.rawName, psk: ch.psk }], this.loraRaw, index !== 0)
  }

  /**
   * Записать узел с ключом в базу радио (admin add_contact, прошивка 2.7.12+).
   * Радио помечает его избранным, чтобы не вытеснить.
   */
  async addContact(num: number, peer: MtPeer): Promise<void> {
    const prev = this.node(num)
    const longName = peer.longName || prev?.user?.longName || nodeIdOf(num)
    const shortName = peer.shortName || prev?.user?.shortName || nodeIdOf(num).slice(-4)
    await this.admin({
      payloadVariant: {
        case: 'addContact',
        value: {
          nodeNum: num >>> 0,
          user: {
            id: nodeIdOf(num),
            longName,
            shortName,
            publicKey: fromHex(peer.publicKey),
          },
        },
      },
    })
    const user = {
      id: nodeIdOf(num),
      longName,
      shortName,
      hwModel: prev?.user?.hwModel ?? 0,
      hwModelName: prev?.user?.hwModelName ?? null,
      role: prev?.user?.role ?? 0,
      publicKey: peer.publicKey.toLowerCase(),
      isLicensed: false,
      isUnmessagable: false,
    }
    this.nodes.set(num >>> 0, {
      num: num >>> 0,
      user,
      snr: prev?.snr ?? 0,
      lastHeard: prev?.lastHeard ?? 0,
      hopsAway: prev?.hopsAway ?? null,
      viaMqtt: prev?.viaMqtt ?? false,
      isFavorite: true,
      isIgnored: false,
      channel: prev?.channel ?? 0,
      battery: prev?.battery ?? null,
      voltage: prev?.voltage ?? null,
      position: prev?.position ?? null,
    })
    this.emit('nodes')
  }

  /** Забыть узел в базе радио. */
  async removeNode(num: number): Promise<void> {
    await this.admin({ payloadVariant: { case: 'removeByNodenum', value: num >>> 0 } })
    this.nodes.delete(num >>> 0)
    this.emit('nodes')
  }

  async setFavorite(num: number, favorite: boolean): Promise<void> {
    await this.admin({
      payloadVariant: favorite
        ? { case: 'setFavoriteNode', value: num >>> 0 }
        : { case: 'removeFavoriteNode', value: num >>> 0 },
    })
    const node = this.nodes.get(num >>> 0)
    if (node) this.nodes.set(node.num, { ...node, isFavorite: favorite })
    this.emit('nodes')
  }

  /** Имя владельца по admin-запросу — для проверки связи в тестах и отладке. */
  async fetchOwner(): Promise<string | null> {
    const p = await this.admin({ payloadVariant: { case: 'getOwnerRequest', value: true } }, true)
    const d = p?.decoded
    if (!d || d.portnum !== PortNum.ADMIN_APP) return null
    const msg = decodeAdmin(d.payload)
    return msg.payloadVariant.case === 'getOwnerResponse' ? msg.payloadVariant.value.longName : null
  }

  // ─── Закрытие ────────────────────────────────────────────────────────────

  private handleClosed(reason: CloseReason): void {
    if (this.closedFlag) return
    this.closedFlag = true
    reason = this.closeReason ?? reason
    // Итог неизвестен: радио может ещё повторять пакет — оставляем «ушло».
    for (const [id, pend] of this.pending) {
      if (pend.timer) clearTimeout(pend.timer)
      this.pending.delete(id)
      if (pend.final) continue
      pend.onUpdate(pend.queued ? { status: 'sent' } : { status: 'failed', error: 'not_connected' })
    }
    this.waiters.clear()
    this.emit('closed', reason)
  }

  /** Закрыть сеанс. `reason` уходит в событие `closed` (null — закрыл пользователь). */
  async close(reason: CloseReason = null): Promise<void> {
    if (this.closedFlag) return
    this.closeReason = reason
    await this.client.close()
  }
}

function safeRoutingError(payload: Uint8Array): number | null {
  try {
    return decodeRoutingError(payload)
  } catch {
    return null
  }
}

/** Сколько хопов прошёл пакет; null — прошивка не сообщила. */
export function hopsOf(p: Pick<MtPacket, 'hopStart' | 'hopLimit'>): number | null {
  if (!p.hopStart || p.hopStart < p.hopLimit) return null
  return p.hopStart - p.hopLimit
}
