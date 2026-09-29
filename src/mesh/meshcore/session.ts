/**
 * Сеанс работы с companion-радио MeshCore: состояние узла (контакты, каналы)
 * и доставка сообщений поверх команд клиента.
 *
 * Что здесь, а не в клиенте:
 * - повторы личных сообщений. Радио шлёт один раз; ACK не пришёл — приложение
 *   повторяет с attempt+1, а последнюю попытку, сбросив путь, шлёт flood'ом
 *   (docs/faq.md 5.3–5.4). ACK у каждой попытки свой, подходит любой;
 * - сообщения, пришедшие до загрузки контактов: ждут её, иначе у них не было
 *   бы имени отправителя;
 * - каналы по стабильному id (хэш ключа), а не по номеру слота.
 */

import { hopCount, isEmptyChannel, splitChannelText } from './codec'
import type { McBattery, McContact, McDeviceInfo, McIncoming, McSelfInfo, McSent } from './codec'
import { MeshCoreClient, MeshCoreError, keyPrefix, type MeshCoreClientOptions } from './client'
import type { FrameLink } from './framing'
import { OUT_PATH_UNKNOWN, TXT_TYPE } from './constants'
import { channelId, channelKind, type ChannelKind } from './channels'
import type { CloseReason, Unsubscribe } from '../radio/types'

export interface SessionChannel {
  index: number
  name: string
  secret: string
  /** Стабильный id: первые 8 байт SHA-256 ключа. */
  id: string
  kind: ChannelKind
}

interface BaseMessage {
  /** Имя отправителя, если известно. */
  senderName: string | null
  text: string
  /** Секунды по часам отправителя. */
  senderTimestamp: number
  hops: number | null
  snr: number | null
}

export type SessionMessage =
  | (BaseMessage & {
      kind: 'direct'
      /** Первые 6 байт ключа собеседника (hex) — так радио адресует ЛС. */
      peerPrefix: string
      peerKey: string | null
    })
  | (BaseMessage & { kind: 'channel'; channel: SessionChannel })

export type DeliveryStatus = 'sent' | 'delivered' | 'failed'

export interface DeliveryUpdate {
  status: DeliveryStatus
  attempt: number
  flood: boolean
  /** Код отказа, если не ушло совсем. */
  error?: string
}

export interface SessionEvents {
  message: (m: SessionMessage) => void
  contacts: () => void
  channels: () => void
  /** Узел объявился, но в контакты радио не попал (ручное добавление, мест нет). */
  discovered: (contact: McContact) => void
  contactsFull: () => void
  closed: (reason: CloseReason) => void
}

export interface SessionOptions extends MeshCoreClientOptions {
  /** Попыток на личное сообщение, последняя — flood. */
  maxAttempts?: number
  /** Как часто спрашивать очередь радио без уведомления, мс (0 — не спрашивать). */
  pollIntervalMs?: number
  /** Сколько помнить ACK после неудачи: поздний ACK всё равно отметит доставку. */
  lateAckMs?: number
  /** Нижняя и верхняя граница ожидания ACK одной попытки, мс. */
  minAckWaitMs?: number
  maxAckWaitMs?: number
  /** Пауза перед повтором, если очередь отправки радио полна, мс. */
  busyRetryMs?: number
}

interface Delivery {
  onUpdate: (u: DeliveryUpdate) => void
  delivered: boolean
  attempt: number
  flood: boolean
  /** Отпустить ожидание текущей попытки. */
  wake: (() => void) | null
  expiresAt: number
}

/** Сколько раз ждать освобождения очереди отправки радио. */
const MAX_BUSY_RETRIES = 5

const DEFAULTS = {
  maxAttempts: 4,
  pollIntervalMs: 60_000,
  lateAckMs: 10 * 60_000,
  minAckWaitMs: 4_000,
  maxAckWaitMs: 90_000,
  busyRetryMs: 3_000,
}

export class MeshCoreSession {
  readonly contacts = new Map<string, McContact>()
  channels: SessionChannel[] = []
  /** Всего слотов каналов на радио (последний индекс + 1). */
  channelSlots = 0
  self!: McSelfInfo
  device: McDeviceInfo | null = null

  private readonly client: MeshCoreClient
  private readonly opts: typeof DEFAULTS
  private readonly listeners: { [K in keyof SessionEvents]: Set<SessionEvents[K]> } = {
    message: new Set(),
    contacts: new Set(),
    channels: new Set(),
    discovered: new Set(),
    contactsFull: new Set(),
    closed: new Set(),
  }
  private readonly deliveries = new Map<string, Delivery>()
  private incoming: Promise<void> = Promise.resolve()
  private readyResolve!: () => void
  private readonly ready = new Promise<void>((r) => (this.readyResolve = r))
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private closed = false

  private constructor(link: FrameLink, options: SessionOptions) {
    this.client = new MeshCoreClient(link, options)
    this.opts = { ...DEFAULTS, ...stripUndefined(options) }
    // Подписки — до знакомства с радио: уведомление о сообщениях может прийти
    // в ответ на первую же команду.
    this.client.on('message', (m) => this.queueIncoming(m))
    this.client.on('ack', (ack) => this.onAck(ack))
    this.client.on('advert', (key) => void this.refreshContact(key))
    this.client.on('pathUpdated', (key) => void this.refreshContact(key))
    this.client.on('contactDeleted', (key) => {
      if (this.contacts.delete(key)) this.emit('contacts')
    })
    this.client.on('discovered', (c) => this.emit('discovered', c))
    this.client.on('contactsFull', () => this.emit('contactsFull'))
    this.client.on('closed', (reason) => {
      this.stop()
      this.emit('closed', reason)
    })
  }

  /**
   * Сеанс без обмена с радио: сначала подписаться на `message`, потом
   * `start()`. Иначе сообщения, которые радио накопило, пока приложение было
   * отключено, ушли бы из его очереди до подписки — и пропали.
   */
  static create(link: FrameLink, options: SessionOptions = {}): MeshCoreSession {
    return new MeshCoreSession(link, options)
  }

  /** Создать и сразу начать — когда входящие не нужны с первой секунды. */
  static async open(link: FrameLink, options: SessionOptions = {}): Promise<MeshCoreSession> {
    const session = MeshCoreSession.create(link, options)
    await session.start()
    return session
  }

  /** Знакомство с радио, контакты, каналы и выгрузка накопленных сообщений. */
  async start(): Promise<void> {
    try {
      await this.init()
    } catch (e) {
      await this.close()
      throw e
    }
  }

  private async init(): Promise<void> {
    const { self, device } = await this.client.start()
    this.self = self
    this.device = device
    await this.reloadContacts()
    await this.reloadChannels()
    this.readyResolve()
    await this.client.syncMessages()
    if (this.opts.pollIntervalMs > 0) {
      this.pollTimer = setInterval(() => {
        void this.client.syncMessages()
        this.dropExpiredDeliveries()
      }, this.opts.pollIntervalMs)
    }
  }

  get transport(): FrameLink['kind'] {
    return this.client.transport
  }

  get label(): string {
    return this.client.label
  }

  get isClosed(): boolean {
    return this.closed
  }

  on<K extends keyof SessionEvents>(event: K, cb: SessionEvents[K]): Unsubscribe {
    const set = this.listeners[event] as Set<SessionEvents[K]>
    set.add(cb)
    return () => set.delete(cb)
  }

  private emit<K extends keyof SessionEvents>(
    event: K,
    ...args: Parameters<SessionEvents[K]>
  ): void {
    for (const cb of [...this.listeners[event]] as Array<
      (...a: Parameters<SessionEvents[K]>) => void
    >) {
      try {
        cb(...args)
      } catch (e) {
        console.warn(`[mesh] listener ${event} failed`, e)
      }
    }
  }

  // ─── Контакты ─────────────────────────────────────────────────────────────

  async reloadContacts(): Promise<void> {
    const list = await this.client.getContacts()
    this.contacts.clear()
    for (const c of list) this.contacts.set(c.publicKey, c)
    this.emit('contacts')
  }

  private async refreshContact(publicKey: string): Promise<void> {
    try {
      const c = await this.client.getContactByKey(publicKey)
      if (c) this.contacts.set(c.publicKey, c)
      else this.contacts.delete(publicKey)
      this.emit('contacts')
    } catch (e) {
      if (!this.closed) console.warn('[mesh] contact refresh failed', e)
    }
  }

  /** Контакт по началу ключа (6 байт у ЛС, 4 байта у автора в комнате). */
  findContact(prefix: string): McContact | null {
    const p = prefix.toLowerCase()
    for (const c of this.contacts.values()) if (c.publicKey.startsWith(p)) return c
    return null
  }

  /** Добавить на радио узел, который объявился, но в контакты не попал. */
  async addContact(contact: McContact): Promise<void> {
    await this.client.addContact({
      ...contact,
      // Путь нам неизвестен: первые сообщения пойдут flood'ом.
      outPathLen: OUT_PATH_UNKNOWN,
      lastMod: Math.floor(Date.now() / 1000),
    })
    await this.refreshContact(contact.publicKey)
  }

  async removeContact(publicKey: string): Promise<void> {
    await this.client.removeContact(publicKey)
    if (this.contacts.delete(publicKey)) this.emit('contacts')
  }

  /** Объявить себя: `flood` — всей сети, иначе только соседям. */
  async sendAdvert(flood: boolean): Promise<void> {
    await this.client.sendSelfAdvert(flood)
  }

  async rename(name: string): Promise<void> {
    await this.client.setAdvertName(name)
    this.self = { ...this.self, name: name.trim() }
  }

  async battery(): Promise<McBattery> {
    return this.client.getBattery()
  }

  // ─── Каналы ───────────────────────────────────────────────────────────────

  async reloadChannels(): Promise<void> {
    const max = Math.min(this.device?.maxChannels ?? 40, 64)
    const found: SessionChannel[] = []
    let slots = 0
    for (let index = 0; index < max; index++) {
      const c = await this.client.getChannel(index)
      if (!c) break
      slots = index + 1
      if (isEmptyChannel(c)) continue
      found.push({
        index,
        name: c.name,
        secret: c.secret,
        id: await channelId(c.secret),
        kind: await channelKind(c.name, c.secret),
      })
    }
    this.channels = found
    this.channelSlots = slots
    this.emit('channels')
  }

  /** Записать канал в первый свободный слот. */
  async addChannel(name: string, secretHex: string): Promise<SessionChannel> {
    const id = await channelId(secretHex)
    const existing = this.channels.find((c) => c.id === id)
    if (existing) return existing
    const used = new Set(this.channels.map((c) => c.index))
    let slot = -1
    for (let i = 0; i < this.channelSlots; i++) {
      if (!used.has(i)) {
        slot = i
        break
      }
    }
    if (slot === -1) throw new MeshCoreError('rejected', 3, 'channels_full')
    await this.client.setChannel(slot, name, secretHex)
    await this.reloadChannels()
    const added = this.channels.find((c) => c.id === id)
    if (!added) throw new MeshCoreError('bad_frame', null, 'channel not saved')
    return added
  }

  async removeChannel(index: number): Promise<void> {
    await this.client.setChannel(index, '', '0'.repeat(32))
    await this.reloadChannels()
  }

  // ─── Входящие ─────────────────────────────────────────────────────────────

  private queueIncoming(m: McIncoming): void {
    // По одному и по порядку, после загрузки контактов и каналов.
    this.incoming = this.incoming
      .then(() => this.ready)
      .then(() => this.handleIncoming(m))
      .catch((e: unknown) => console.warn('[mesh] incoming message failed', e))
  }

  private async handleIncoming(m: McIncoming): Promise<void> {
    if (m.kind === 'channelData') return // датаграммы приложений — пока не нужны
    if (m.kind === 'contact') {
      // Ответы репитеров на команды — не переписка.
      if (m.txtType === TXT_TYPE.CLI_DATA) return
      let contact = this.findContact(m.senderPrefix)
      if (!contact) {
        await this.reloadContacts()
        contact = this.findContact(m.senderPrefix)
      }
      // Пост в комнате (room server): отправитель — комната, автор — по
      // 4 байтам ключа.
      const author =
        m.txtType === TXT_TYPE.SIGNED_PLAIN && m.authorPrefix
          ? (this.findContact(m.authorPrefix)?.name ?? m.authorPrefix)
          : null
      this.emit('message', {
        kind: 'direct',
        peerPrefix: m.senderPrefix,
        peerKey: contact?.publicKey ?? null,
        senderName: author ?? contact?.name ?? null,
        text: m.text,
        senderTimestamp: m.senderTimestamp,
        hops: hopCount(m.pathLen),
        snr: m.snr,
      })
      return
    }
    let channel = this.channels.find((c) => c.index === m.channelIndex)
    if (!channel) {
      await this.reloadChannels()
      channel = this.channels.find((c) => c.index === m.channelIndex)
    }
    if (!channel) return
    const { sender, body } = splitChannelText(m.text)
    this.emit('message', {
      kind: 'channel',
      channel,
      senderName: sender,
      text: body,
      senderTimestamp: m.senderTimestamp,
      hops: hopCount(m.pathLen),
      snr: m.snr,
    })
  }

  // ─── Отправка ─────────────────────────────────────────────────────────────

  /**
   * Личное сообщение с повторами. Промис завершается, когда судьба сообщения
   * решена (доставлено или попытки кончились); ход дел — в `onUpdate`.
   * `timestamp` один на все попытки: по нему получатель узнаёт повтор.
   */
  async sendDirect(
    peerKey: string,
    text: string,
    timestamp: number,
    onUpdate: (u: DeliveryUpdate) => void
  ): Promise<DeliveryStatus> {
    const delivery: Delivery = {
      onUpdate,
      delivered: false,
      attempt: 0,
      flood: false,
      wake: null,
      expiresAt: 0,
    }
    const acks: string[] = []
    let lastFlood = false
    let busyRetries = 0
    for (let attempt = 0; attempt < this.opts.maxAttempts && !delivery.delivered; attempt++) {
      if (this.closed) break
      // Последняя попытка — по всей сети: выученный путь мог устареть.
      if (attempt === this.opts.maxAttempts - 1 && attempt > 0 && !lastFlood) {
        try {
          await this.client.resetPath(peerKey)
        } catch {
          /* контакт мог пропасть — отправка ниже скажет точнее */
        }
      }
      let sent: McSent
      try {
        sent = await this.client.sendText(peerKey, text, timestamp, attempt)
      } catch (e) {
        if (
          e instanceof MeshCoreError &&
          e.tableFull &&
          !this.closed &&
          busyRetries < MAX_BUSY_RETRIES
        ) {
          // Очередь отправки радио полна: подождать и повторить ту же попытку.
          busyRetries++
          await sleep(this.opts.busyRetryMs)
          attempt--
          continue
        }
        const code =
          e instanceof MeshCoreError ? (e.notFound ? 'not_in_contacts' : e.code) : 'send_failed'
        onUpdate({ status: 'failed', attempt, flood: lastFlood, error: code })
        this.forgetAcks(acks)
        return 'failed'
      }
      lastFlood = sent.flood
      delivery.attempt = attempt
      delivery.flood = sent.flood
      acks.push(sent.ack)
      this.deliveries.set(sent.ack, delivery)
      onUpdate({ status: 'sent', attempt, flood: sent.flood })
      const wait = clamp(
        Math.round(sent.timeoutMs * 1.25),
        this.opts.minAckWaitMs,
        this.opts.maxAckWaitMs
      )
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          delivery.wake = null
          resolve()
        }, wait)
        delivery.wake = () => {
          clearTimeout(timer)
          delivery.wake = null
          resolve()
        }
      })
    }
    if (delivery.delivered) {
      this.forgetAcks(acks)
      return 'delivered'
    }
    onUpdate({ status: 'failed', attempt: delivery.attempt, flood: lastFlood })
    // ACK может прийти и после: сообщение дошло, а ответ задержался.
    delivery.expiresAt = Date.now() + this.opts.lateAckMs
    return 'failed'
  }

  private onAck(ack: string): void {
    const delivery = this.deliveries.get(ack)
    if (!delivery || delivery.delivered) return
    delivery.delivered = true
    delivery.onUpdate({ status: 'delivered', attempt: delivery.attempt, flood: delivery.flood })
    delivery.wake?.()
    if (delivery.expiresAt > 0) {
      // Поздний ACK после «не доставлено» — остальные ACK этой отправки не нужны.
      for (const [key, d] of this.deliveries) if (d === delivery) this.deliveries.delete(key)
    }
  }

  private forgetAcks(acks: string[]): void {
    for (const a of acks) this.deliveries.delete(a)
  }

  private dropExpiredDeliveries(): void {
    const now = Date.now()
    for (const [key, d] of this.deliveries) {
      if (d.expiresAt > 0 && d.expiresAt < now) this.deliveries.delete(key)
    }
  }

  /** Сообщение в канал. Подтверждений у каналов нет: «ушло» — это всё. */
  async sendChannel(channel: SessionChannel, text: string, timestamp: number): Promise<void> {
    const current = this.channels.find((c) => c.id === channel.id)
    if (!current) throw new MeshCoreError('rejected', 2, 'channel_not_found')
    await this.client.sendChannelText(current.index, text, timestamp)
  }

  /** Сколько байт текста помещается в сообщение канала: радио допишет «имя: ». */
  channelTextLimit(maxTextLen: number): number {
    const prefix = new TextEncoder().encode(`${this.self?.name ?? ''}: `).length
    return Math.max(0, maxTextLen - prefix)
  }

  // ─── Закрытие ─────────────────────────────────────────────────────────────

  private stop(): void {
    if (this.closed) return
    this.closed = true
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    for (const d of this.deliveries.values()) d.wake?.()
  }

  async close(): Promise<void> {
    this.stop()
    await this.client.close()
  }
}

/** Ключ для адресации ЛС и id диалога — первые 6 байт. */
export { keyPrefix }

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(o))
    if (v !== undefined) (out as Record<string, unknown>)[k] = v
  return out
}
