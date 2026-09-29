/**
 * Клиент API Meshtastic: рукопожатие, поток FromRadio, отправка ToRadio.
 *
 * Рукопожатие (src/mesh/PhoneAPI.cpp): клиент шлёт `want_config_id` со
 * случайным номером, радио отвечает my_info, свой NodeInfo, metadata, восемь
 * каналов, секции config и module_config, остальные узлы и в конце
 * `config_complete_id` с тем же номером. Дальше идут пакеты из эфира
 * (накопленные, пока клиента не было, — первыми), `queueStatus` на каждую
 * отправку и обновления узлов.
 *
 * Запросов с ответом тут нет: доставку и ответы admin сеанс узнаёт по
 * Routing-пакетам с `request_id` своего пакета.
 */

import type { CloseReason, Unsubscribe } from '../radio/types'
import {
  decodeFromRadio,
  encodeDisconnect,
  encodeHeartbeat,
  encodePacket,
  encodeWantConfig,
  type MtChannel,
  type MtFromRadio,
  type MtLoRa,
  type MtMetadata,
  type MtMyInfo,
  type MtNode,
  type MtPacket,
  type MtQueueStatus,
  type PacketInit,
  type RawLoRaConfig,
  type RawUser,
} from './codec'
import { CHANNEL_SLOTS, CONFIG_TIMEOUT_MS, HEARTBEAT_MS } from './constants'
import type { PacketLink } from './framing'

export class MeshtasticError extends Error {
  constructor(
    public readonly code: 'timeout' | 'closed' | 'rejected' | 'bad_packet',
    message?: string
  ) {
    super(message ?? code)
    this.name = 'MeshtasticError'
  }
}

/** Всё, что радио рассказало о себе при подключении. */
export interface ConfigSnapshot {
  myInfo: MtMyInfo
  metadata: MtMetadata | null
  nodes: Map<number, MtNode>
  /** Свой User как protobuf — для смены имени. */
  selfUser: RawUser | null
  channels: MtChannel[]
  lora: MtLoRa | null
  loraRaw: RawLoRaConfig | null
}

export interface MeshtasticClientEvents {
  packet: (p: MtPacket) => void
  nodeInfo: (node: MtNode, rawUser: RawUser | null) => void
  channel: (c: MtChannel) => void
  lora: (lora: MtLoRa, raw: RawLoRaConfig) => void
  queueStatus: (s: MtQueueStatus) => void
  notification: (n: { level: number; message: string; replyId: number | null }) => void
  /** Радио перезагрузилось (serial оставался открытым). */
  rebooted: () => void
  /** Строка отладочного вывода платы. */
  text: (line: string) => void
  closed: (reason: CloseReason) => void
}

type Listeners = { [K in keyof MeshtasticClientEvents]: Set<MeshtasticClientEvents[K]> }

export interface ClientOptions {
  /** Сколько ждать следующей части рукопожатия. */
  configIdleMs?: number
  /** Сколько ждать рукопожатия целиком. */
  configTotalMs?: number
  heartbeatMs?: number
}

function randomNonce(): number {
  const v = crypto.getRandomValues(new Uint32Array(1))[0]!
  // 69420 и 69421 прошивка понимает как «только конфиг» / «только узлы».
  return v < 70_000 ? v + 70_000 : v
}

export class MeshtasticClient {
  private readonly listeners: Listeners = {
    packet: new Set(),
    nodeInfo: new Set(),
    channel: new Set(),
    lora: new Set(),
    queueStatus: new Set(),
    notification: new Set(),
    rebooted: new Set(),
    text: new Set(),
    closed: new Set(),
  }
  private readonly unsubs: Unsubscribe[] = []
  private writing: Promise<void> = Promise.resolve()
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private closed = false
  /** Идёт рукопожатие: пакеты конфига собираются в снимок. */
  private collecting: {
    nonce: number
    snapshot: Partial<ConfigSnapshot> & {
      nodes: Map<number, MtNode>
      channels: MtChannel[]
    }
    touch: () => void
    done: (s: ConfigSnapshot) => void
  } | null = null
  private readonly opts: Required<ClientOptions>

  constructor(
    readonly link: PacketLink,
    opts: ClientOptions = {}
  ) {
    this.opts = {
      // ESP32 по BLE отдаёт узлы по одному чтению — на медленной связи это долго.
      configIdleMs: opts.configIdleMs ?? 20_000,
      configTotalMs: opts.configTotalMs ?? CONFIG_TIMEOUT_MS,
      heartbeatMs: opts.heartbeatMs ?? HEARTBEAT_MS,
    }
    this.unsubs.push(link.onPacket((bytes) => this.handle(bytes)))
    this.unsubs.push(link.onText((line) => this.emit('text', line)))
    this.unsubs.push(link.onClose((reason) => this.shutdown(reason ?? 'device_lost')))
  }

  on<K extends keyof MeshtasticClientEvents>(event: K, cb: MeshtasticClientEvents[K]): Unsubscribe {
    this.listeners[event].add(cb)
    return () => this.listeners[event].delete(cb)
  }

  private emit<K extends keyof MeshtasticClientEvents>(
    event: K,
    ...args: Parameters<MeshtasticClientEvents[K]>
  ): void {
    for (const cb of [...this.listeners[event]]) {
      ;(cb as (...a: Parameters<MeshtasticClientEvents[K]>) => void)(...args)
    }
  }

  get isClosed(): boolean {
    return this.closed
  }

  /** Отправить ToRadio. Записи идут строго по очереди. */
  send(bytes: Uint8Array): Promise<void> {
    if (this.closed) return Promise.reject(new MeshtasticError('closed'))
    const next = this.writing.then(() => this.link.send(bytes))
    this.writing = next.catch(() => {})
    return next
  }

  sendPacket(init: PacketInit): Promise<void> {
    return this.send(encodePacket(init))
  }

  /**
   * Рукопожатие: радио отдаёт конфиг, каналы и узлы. Потом начинает
   * присылать пакеты — подписываться на них надо до вызова.
   */
  configure(): Promise<ConfigSnapshot> {
    if (this.closed) return Promise.reject(new MeshtasticError('closed'))
    const nonce = randomNonce()
    return new Promise<ConfigSnapshot>((resolve, reject) => {
      let idle: ReturnType<typeof setTimeout> | null = null
      const total = setTimeout(() => fail('timeout'), this.opts.configTotalMs)
      const stopClose = this.on('closed', (reason) => fail('closed', reason ?? undefined))
      const touch = (): void => {
        if (idle) clearTimeout(idle)
        idle = setTimeout(() => fail('timeout'), this.opts.configIdleMs)
      }
      const finish = (): void => {
        if (idle) clearTimeout(idle)
        clearTimeout(total)
        stopClose()
        this.collecting = null
      }
      const fail = (code: 'timeout' | 'closed', message?: string): void => {
        finish()
        reject(new MeshtasticError(code, message))
      }
      this.collecting = {
        nonce,
        snapshot: { nodes: new Map(), channels: [] },
        touch,
        done: (s) => {
          finish()
          this.startHeartbeat()
          resolve(s)
        },
      }
      touch()
      void (async () => {
        try {
          await this.link.wake()
          await this.send(encodeWantConfig(nonce))
        } catch (e) {
          fail('closed', e instanceof Error ? e.message : undefined)
        }
      })()
    })
  }

  private startHeartbeat(): void {
    // BLE держит соединение сам; поток (serial, TCP) без трафика радио закрывает.
    if (this.link.kind === 'ble' || this.heartbeat || this.opts.heartbeatMs <= 0) return
    this.heartbeat = setInterval(() => {
      void this.send(encodeHeartbeat(randomNonce())).catch(() => {})
    }, this.opts.heartbeatMs)
  }

  private handle(bytes: Uint8Array): void {
    let msg: MtFromRadio
    try {
      msg = decodeFromRadio(bytes)
    } catch {
      return // битый пакет (обрыв посреди кадра) — пропускаем
    }
    const c = this.collecting
    if (c) {
      c.touch()
      const s = c.snapshot
      switch (msg.kind) {
        case 'myInfo':
          s.myInfo = msg.info
          return
        case 'nodeInfo':
          s.nodes.set(msg.node.num, msg.node)
          if (s.myInfo && msg.node.num === s.myInfo.nodeNum) s.selfUser = msg.rawUser
          return
        case 'metadata':
          s.metadata = msg.metadata
          return
        case 'channel':
          s.channels[msg.channel.index] = msg.channel
          return
        case 'config':
          if (msg.config.kind === 'lora') {
            s.lora = msg.config.lora
            s.loraRaw = msg.config.raw
          }
          return
        case 'configComplete':
          if (msg.id !== c.nonce || !s.myInfo) return
          c.done({
            myInfo: s.myInfo,
            metadata: s.metadata ?? null,
            nodes: s.nodes,
            selfUser: s.selfUser ?? null,
            channels: normalizeChannels(s.channels),
            lora: s.lora ?? null,
            loraRaw: s.loraRaw ?? null,
          })
          return
        default:
          break // пакеты и прочее — как обычно
      }
    }
    switch (msg.kind) {
      case 'packet':
        this.emit('packet', msg.packet)
        break
      case 'nodeInfo':
        this.emit('nodeInfo', msg.node, msg.rawUser)
        break
      case 'channel':
        this.emit('channel', msg.channel)
        break
      case 'config':
        if (msg.config.kind === 'lora') this.emit('lora', msg.config.lora, msg.config.raw)
        break
      case 'queueStatus':
        this.emit('queueStatus', msg.status)
        break
      case 'notification':
        this.emit('notification', msg)
        break
      case 'rebooted':
        this.emit('rebooted')
        break
      case 'log':
        this.emit('text', msg.message)
        break
      default:
        break
    }
  }

  private shutdown(reason: CloseReason): void {
    if (this.closed) return
    this.closed = true
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = null
    for (const u of this.unsubs.splice(0)) u()
    this.emit('closed', reason)
  }

  /** Попрощаться с радио и закрыть соединение. */
  async close(): Promise<void> {
    if (this.closed) return
    try {
      await Promise.race([this.send(encodeDisconnect()), new Promise((r) => setTimeout(r, 300))])
    } catch {
      /* соединение уже пропало */
    }
    this.shutdown(null)
    await this.link.close().catch(() => {})
  }
}

/** Все восемь слотов по порядку; пропущенные — выключенными. */
function normalizeChannels(list: MtChannel[]): MtChannel[] {
  const out: MtChannel[] = []
  for (let i = 0; i < CHANNEL_SLOTS; i++) {
    out.push(
      list[i] ?? {
        index: i,
        role: 'disabled',
        name: '',
        psk: new Uint8Array(0),
        uplinkEnabled: false,
        downlinkEnabled: false,
        positionPrecision: 0,
        muted: false,
      }
    )
  }
  return out
}
