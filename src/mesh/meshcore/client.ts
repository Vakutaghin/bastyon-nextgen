/**
 * Клиент companion-радио MeshCore: команды, ответы и уведомления.
 *
 * Радио отвечает строго по одной команде и без номера запроса — ответ
 * узнаётся по коду кадра (docs/companion_protocol.md, «Command Sequencing»).
 * Поэтому команды стоят в очереди, и следующая уходит только после ответа
 * или таймаута. Уведомления (коды 0x80+) приходят в любой момент и в очередь
 * не попадают.
 */

import type { CloseReason, Unsubscribe } from '../radio/types'
import {
  decodeBattery,
  decodeChannelInfo,
  decodeContact,
  decodeDeviceInfo,
  decodeIncoming,
  decodeKeyPush,
  decodeLoginResult,
  decodeSelfInfo,
  decodeSendConfirmed,
  decodeSent,
  decodeU32After,
  encode,
  MESSAGE_CODES,
  type McBattery,
  type McChannel,
  type McContact,
  type McDeviceInfo,
  type McIncoming,
  type McLoginResult,
  type McSelfInfo,
  type McSent,
} from './codec'
import { APP_PROTOCOL_VERSION, COMMAND_TIMEOUT_MS, ERR_CODE, PUSH, RESP } from './constants'
import type { FrameLink } from './framing'

/** Ошибка команды: радио ответило RESP_ERR, отключено или не ответило. */
export class MeshCoreError extends Error {
  constructor(
    public readonly code: 'rejected' | 'disabled' | 'timeout' | 'closed' | 'bad_frame',
    /** ERR_CODE_* из ответа радио. */
    public readonly errCode: number | null = null,
    message?: string
  ) {
    super(message ?? (errCode === null ? code : `${code}:${errCode}`))
    this.name = 'MeshCoreError'
  }

  get notFound(): boolean {
    return this.errCode === ERR_CODE.NOT_FOUND
  }

  get tableFull(): boolean {
    return this.errCode === ERR_CODE.TABLE_FULL
  }
}

type Verdict = 'done' | 'more' | 'skip'

interface Pending {
  frame: Uint8Array
  expect: (code: number) => Verdict
  collected: Uint8Array[]
  timeoutMs: number
  resolve: (frames: Uint8Array[]) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout> | null
}

export interface MeshCoreEvents {
  /** Сообщение из очереди радио (личное, в канале, датаграмма). */
  message: (m: McIncoming) => void
  /** Получатель подтвердил личное сообщение. */
  ack: (ack: string, tripMs: number) => void
  /** Контакт на радио объявился снова — его данные стоит перечитать. */
  advert: (publicKey: string) => void
  pathUpdated: (publicKey: string) => void
  /** Новый узел, которого нет в контактах радио (ручное добавление). */
  discovered: (contact: McContact) => void
  contactDeleted: (publicKey: string) => void
  contactsFull: () => void
  /** Ответ комнаты на вход (успех или отказ). */
  login: (result: McLoginResult) => void
  /** Соединение пропало не по `close()`. */
  closed: (reason: CloseReason) => void
}

type Listeners = { [K in keyof MeshCoreEvents]: Set<MeshCoreEvents[K]> }

export interface MeshCoreClientOptions {
  /** Имя приложения, которое радио пишет в свой лог. */
  appName?: string
  commandTimeoutMs?: number
  /** Часы для SET_DEVICE_TIME (секунды). Подменяются в тестах. */
  nowSeconds?: () => number
  log?: (message: string, detail?: unknown) => void
}

/** Сколько кадров вычитывать за один проход очереди — защита от зацикливания. */
const MAX_SYNC_PER_PASS = 512

/** Кусок данных на подпись: кадр радио — не больше MAX_FRAME_SIZE (176). */
const SIGN_CHUNK = 160

const noop = (): void => {}

export class MeshCoreClient {
  private readonly queue: Pending[] = []
  private current: Pending | null = null
  private closed = false
  private syncing: Promise<void> | null = null
  private syncAgain = false
  private readonly listeners: Listeners = {
    message: new Set(),
    ack: new Set(),
    advert: new Set(),
    pathUpdated: new Set(),
    discovered: new Set(),
    contactDeleted: new Set(),
    contactsFull: new Set(),
    login: new Set(),
    closed: new Set(),
  }
  private readonly unsubs: Unsubscribe[] = []
  private readonly timeoutMs: number
  private readonly nowSeconds: () => number
  private readonly log: (message: string, detail?: unknown) => void
  readonly appName: string

  constructor(
    private readonly link: FrameLink,
    options: MeshCoreClientOptions = {}
  ) {
    this.appName = options.appName ?? 'Bastyon'
    this.timeoutMs = options.commandTimeoutMs ?? COMMAND_TIMEOUT_MS
    this.nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000))
    this.log = options.log ?? noop
    this.unsubs.push(link.onFrame((f) => this.onFrame(f)))
    this.unsubs.push(
      link.onClose((reason) => {
        this.shutdown(new MeshCoreError('closed', null, reason ?? 'closed'))
        for (const cb of [...this.listeners.closed]) cb(reason)
      })
    )
  }

  get transport(): FrameLink['kind'] {
    return this.link.kind
  }

  get label(): string {
    return this.link.label
  }

  get isClosed(): boolean {
    return this.closed
  }

  on<K extends keyof MeshCoreEvents>(event: K, cb: MeshCoreEvents[K]): Unsubscribe {
    const set = this.listeners[event] as Set<MeshCoreEvents[K]>
    set.add(cb)
    return () => set.delete(cb)
  }

  private emit<K extends keyof MeshCoreEvents>(
    event: K,
    ...args: Parameters<MeshCoreEvents[K]>
  ): void {
    for (const cb of [...this.listeners[event]] as Array<
      (...a: Parameters<MeshCoreEvents[K]>) => void
    >) {
      try {
        cb(...args)
      } catch (e) {
        this.log(`listener ${event} failed`, e)
      }
    }
  }

  // ─── Очередь команд ───────────────────────────────────────────────────────

  private request(
    frame: Uint8Array,
    expect: (code: number) => Verdict,
    timeoutMs = this.timeoutMs
  ): Promise<Uint8Array[]> {
    if (this.closed) return Promise.reject(new MeshCoreError('closed'))
    return new Promise((resolve, reject) => {
      this.queue.push({ frame, expect, collected: [], timeoutMs, resolve, reject, timer: null })
      this.pump()
    })
  }

  /** Ответ из набора кодов; RESP_ERR и RESP_DISABLED — всегда конец команды. */
  private expectOne(...codes: number[]): (code: number) => Verdict {
    return (code) =>
      codes.includes(code) || code === RESP.ERR || code === RESP.DISABLED ? 'done' : 'skip'
  }

  private pump(): void {
    if (this.current || this.closed) return
    const next = this.queue.shift()
    if (!next) return
    this.current = next
    this.armTimer(next)
    this.link.send(next.frame).catch((e: unknown) => {
      if (this.current !== next) return
      this.finish(next, e instanceof Error ? e : new Error(String(e)))
    })
  }

  private armTimer(p: Pending): void {
    if (p.timer) clearTimeout(p.timer)
    p.timer = setTimeout(() => {
      if (this.current !== p) return
      this.finish(p, new MeshCoreError('timeout', null, `no answer to command ${p.frame[0]}`))
    }, p.timeoutMs)
  }

  private finish(p: Pending, error: Error | null): void {
    if (p.timer) clearTimeout(p.timer)
    p.timer = null
    if (this.current === p) this.current = null
    if (error) {
      p.reject(error)
    } else {
      const last = p.collected[p.collected.length - 1]
      if (last && last[0] === RESP.ERR) {
        p.reject(new MeshCoreError('rejected', last.length > 1 ? last[1]! : null))
      } else if (last && last[0] === RESP.DISABLED) {
        p.reject(new MeshCoreError('disabled'))
      } else {
        p.resolve(p.collected)
      }
    }
    this.pump()
  }

  private onFrame(frame: Uint8Array): void {
    if (frame.length === 0) return
    const code = frame[0]!
    if (code >= 0x80) {
      this.onPush(code, frame)
      return
    }
    const p = this.current
    if (p) {
      const verdict = p.expect(code)
      if (verdict !== 'skip') {
        p.collected.push(frame)
        if (verdict === 'done') this.finish(p, null)
        else this.armTimer(p) // поток кадров идёт — таймаут с начала
        return
      }
    }
    // Кадр-сообщение без ожидающей команды: отдать его всё равно лучше, чем
    // потерять (радио уже удалило его из своей очереди).
    if (MESSAGE_CODES.has(code)) {
      this.deliverMessage(frame)
      return
    }
    this.log('unexpected frame', { code, current: p?.frame[0] ?? null })
  }

  private onPush(code: number, frame: Uint8Array): void {
    try {
      switch (code) {
        case PUSH.MSG_WAITING:
          void this.syncMessages()
          break
        case PUSH.SEND_CONFIRMED: {
          const { ack, tripMs } = decodeSendConfirmed(frame)
          this.emit('ack', ack, tripMs)
          break
        }
        case PUSH.ADVERT:
          this.emit('advert', decodeKeyPush(frame))
          break
        case PUSH.PATH_UPDATED:
          this.emit('pathUpdated', decodeKeyPush(frame))
          break
        case PUSH.NEW_ADVERT:
          this.emit('discovered', decodeContact(frame))
          break
        case PUSH.CONTACT_DELETED:
          this.emit('contactDeleted', decodeKeyPush(frame))
          break
        case PUSH.CONTACTS_FULL:
          this.emit('contactsFull')
          break
        case PUSH.LOGIN_SUCCESS:
        case PUSH.LOGIN_FAIL:
          this.emit('login', decodeLoginResult(frame))
          break
        default:
          // Лог эфира, телеметрия, ответы репитеров — пока не нужны.
          break
      }
    } catch (e) {
      this.log('bad push frame', { code, error: e })
    }
  }

  private deliverMessage(frame: Uint8Array): void {
    try {
      this.emit('message', decodeIncoming(frame))
    } catch (e) {
      this.log('bad message frame', e)
    }
  }

  // ─── Команды ──────────────────────────────────────────────────────────────

  /**
   * Знакомство с радио: APP_START (кто мы, в ответ — сведения об узле),
   * DEVICE_QUERY (версия протокола; с 3 сообщения несут SNR) и время:
   * по нему радио ставит метки и отсекает повторы.
   */
  async start(): Promise<{ self: McSelfInfo; device: McDeviceInfo | null }> {
    const [selfFrame] = await this.request(
      encode.appStart(this.appName),
      this.expectOne(RESP.SELF_INFO)
    )
    const self = decodeSelfInfo(selfFrame!)
    let device: McDeviceInfo | null = null
    try {
      const [info] = await this.request(
        encode.deviceQuery(APP_PROTOCOL_VERSION),
        this.expectOne(RESP.DEVICE_INFO)
      )
      device = decodeDeviceInfo(info!)
    } catch (e) {
      // Очень старые прошивки команду не знают — сообщения будут без SNR.
      this.log('device query failed', e)
    }
    await this.syncTime()
    return { self, device }
  }

  /** Часы радио вперёд нельзя отвести назад — прошивка ответит ILLEGAL_ARG. */
  async syncTime(): Promise<void> {
    try {
      await this.request(encode.setDeviceTime(this.nowSeconds()), this.expectOne(RESP.OK))
    } catch (e) {
      if (e instanceof MeshCoreError && e.code === 'rejected') return
      throw e
    }
  }

  async getContacts(since?: number): Promise<McContact[]> {
    // Контакты идут потоком: START, по кадру на контакт, END.
    const frames = await this.request(
      encode.getContacts(since),
      (code) => {
        if (code === RESP.CONTACTS_START || code === RESP.CONTACT) return 'more'
        if (code === RESP.END_OF_CONTACTS || code === RESP.ERR) return 'done'
        return 'skip'
      },
      // Сотни контактов по BLE идут дольше обычной команды; таймаут
      // перезапускается на каждом кадре, так что это пауза между кадрами.
      this.timeoutMs * 2
    )
    return frames.filter((f) => f[0] === RESP.CONTACT).map(decodeContact)
  }

  async getContactByKey(publicKey: string): Promise<McContact | null> {
    try {
      const [frame] = await this.request(
        encode.getContactByKey(publicKey),
        this.expectOne(RESP.CONTACT)
      )
      return decodeContact(frame!)
    } catch (e) {
      if (e instanceof MeshCoreError && e.notFound) return null
      throw e
    }
  }

  /** Слот канала; `null` — такого номера на радио нет. */
  async getChannel(index: number): Promise<McChannel | null> {
    try {
      const [frame] = await this.request(
        encode.getChannel(index),
        this.expectOne(RESP.CHANNEL_INFO)
      )
      return decodeChannelInfo(frame!)
    } catch (e) {
      if (e instanceof MeshCoreError && e.notFound) return null
      throw e
    }
  }

  async setChannel(index: number, name: string, secretHex: string): Promise<void> {
    await this.request(encode.setChannel(index, name, secretHex), this.expectOne(RESP.OK))
  }

  /** Личное сообщение. `attempt` 0–3 входит в хэш ACK, у каждой попытки свой. */
  async sendText(publicKey: string, text: string, timestamp: number, attempt = 0): Promise<McSent> {
    const [frame] = await this.request(
      encode.sendText(publicKey, text, timestamp, attempt),
      this.expectOne(RESP.SENT)
    )
    return decodeSent(frame!)
  }

  /**
   * Отправить вход в комнату. Ответ комнаты придёт позже событием `login`;
   * здесь — только «радио отправило» и сколько ждать.
   */
  async sendLogin(publicKey: string, password: string): Promise<McSent> {
    const [frame] = await this.request(
      encode.sendLogin(publicKey, password),
      this.expectOne(RESP.SENT)
    )
    return decodeSent(frame!)
  }

  /** Сообщение в канал: подтверждения доставки у каналов нет. */
  async sendChannelText(channelIndex: number, text: string, timestamp: number): Promise<void> {
    await this.request(
      encode.sendChannelText(channelIndex, text, timestamp),
      this.expectOne(RESP.OK)
    )
  }

  async resetPath(publicKey: string): Promise<void> {
    await this.request(encode.resetPath(publicKey), this.expectOne(RESP.OK))
  }

  async sendSelfAdvert(flood: boolean): Promise<void> {
    await this.request(encode.sendSelfAdvert(flood), this.expectOne(RESP.OK))
  }

  async setAdvertName(name: string): Promise<void> {
    await this.request(encode.setAdvertName(name), this.expectOne(RESP.OK))
  }

  async addContact(contact: McContact): Promise<void> {
    await this.request(encode.addUpdateContact(contact), this.expectOne(RESP.OK))
  }

  /**
   * Подписать данные ключом радио (CMD_SIGN_*): подпись Ed25519, 64 байта.
   * Данные идут кусками по SIGN_CHUNK — кадр радио не больше MAX_FRAME_SIZE.
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    const [start] = await this.request(encode.signStart(), this.expectOne(RESP.SIGN_START))
    const max =
      start && start.length >= 6
        ? new DataView(start.buffer, start.byteOffset).getUint32(2, true)
        : 0
    if (data.length > max) throw new MeshCoreError('rejected', ERR_CODE.TABLE_FULL)
    for (let i = 0; i < data.length; i += SIGN_CHUNK) {
      await this.request(encode.signData(data.subarray(i, i + SIGN_CHUNK)), this.expectOne(RESP.OK))
    }
    const [done] = await this.request(encode.signFinish(), this.expectOne(RESP.SIGNATURE))
    if (!done || done.length < 65) throw new MeshCoreError('bad_frame', null, 'short signature')
    return done.slice(1, 65)
  }

  async removeContact(publicKey: string): Promise<void> {
    await this.request(encode.removeContact(publicKey), this.expectOne(RESP.OK))
  }

  async getBattery(): Promise<McBattery> {
    const [frame] = await this.request(encode.getBattery(), this.expectOne(RESP.BATT_AND_STORAGE))
    return decodeBattery(frame!)
  }

  async getDeviceTime(): Promise<number> {
    const [frame] = await this.request(encode.getDeviceTime(), this.expectOne(RESP.CURR_TIME))
    return decodeU32After(frame!)
  }

  /**
   * Забрать всё из очереди радио. Забранное радио удаляет — дальше
   * сообщение живёт только у приложения. Параллельный вызов не начинает
   * второй проход, а просит первый пройти ещё раз.
   */
  syncMessages(): Promise<void> {
    if (this.syncing) {
      this.syncAgain = true
      return this.syncing
    }
    this.syncing = (async () => {
      try {
        do {
          this.syncAgain = false
          for (let i = 0; i < MAX_SYNC_PER_PASS; i++) {
            const [frame] = await this.request(encode.syncNextMessage(), (code) =>
              MESSAGE_CODES.has(code) || code === RESP.NO_MORE_MESSAGES || code === RESP.ERR
                ? 'done'
                : 'skip'
            )
            if (!frame || frame[0] === RESP.NO_MORE_MESSAGES) break
            this.deliverMessage(frame)
          }
        } while (this.syncAgain && !this.closed)
      } catch (e) {
        if (!(e instanceof MeshCoreError && e.code === 'closed')) this.log('sync failed', e)
      } finally {
        this.syncing = null
      }
    })()
    return this.syncing
  }

  /** Отключиться. Уведомление `closed` при этом не приходит. */
  async close(): Promise<void> {
    if (this.closed) return
    this.shutdown(new MeshCoreError('closed'))
    await this.link.close()
  }

  private shutdown(error: Error): void {
    if (this.closed) return
    this.closed = true
    for (const u of this.unsubs.splice(0)) u()
    const pending = [...(this.current ? [this.current] : []), ...this.queue.splice(0)]
    this.current = null
    for (const p of pending) {
      if (p.timer) clearTimeout(p.timer)
      p.reject(error)
    }
  }
}

/** Первые 6 байт ключа: так радио адресует личные сообщения. */
export function keyPrefix(publicKey: string): string {
  return publicKey.slice(0, 12).toLowerCase()
}
