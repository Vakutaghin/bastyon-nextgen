/**
 * Транспорт до радио на Android: плагин MeshRadio
 * (android/app/src/main/java/com/bastyon/app/plugins/radio) — то же, что
 * команды `radio_*` десктопа. Байты ходят через мост в base64.
 *
 * События всех соединений приходят одним потоком `radio`; данные могут прийти
 * раньше, чем протокол подпишется (радио ответило сразу после открытия), —
 * до подписки они копятся.
 *
 * Пока подключено радио, работает служба с постоянным уведомлением: иначе
 * Android усыпил бы приложение в фоне. Сообщения, пришедшие в фоне, плагин
 * показывает системными уведомлениями.
 */

import { App } from '@capacitor/app'
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { t } from '@/i18n'
import { fromBase64, toBase64 } from '../bytes'
import {
  radioErrorFrom,
  type BleDeviceInfo,
  type ByteLink,
  type CloseReason,
  type GattLink,
  type SerialPortInfo,
  type Unsubscribe,
} from './types'

interface RadioEvent {
  link: number
  kind: 'data' | 'notify' | 'closed'
  bytes?: string
  characteristic?: string
  reason?: string | null
}

interface MeshRadioPlugin {
  serialPorts(): Promise<{ ports: SerialPortInfo[] }>
  serialOpen(o: { path: string; baud?: number }): Promise<{ link: number }>
  tcpOpen(o: { host: string; port: number }): Promise<{ link: number }>
  write(o: { link: number; data: string }): Promise<void>
  close(o: { link: number }): Promise<void>
  bleScan(o: { services: string[]; timeoutMs: number }): Promise<{ devices: BleDeviceInfo[] }>
  bleConnect(o: { id: string }): Promise<{ link: number }>
  bleSubscribe(o: { link: number; characteristic: string }): Promise<void>
  bleWrite(o: {
    link: number
    characteristic: string
    data: string
    withResponse: boolean
  }): Promise<void>
  bleRead(o: { link: number; characteristic: string }): Promise<{ data: string }>
  setNotice(o: { title: string; text: string; channel: string }): Promise<void>
  showMessage(o: { title: string; body: string; tag: string; channel: string }): Promise<void>
  requestNotifications(): Promise<void>
  addListener(event: 'radio', cb: (ev: RadioEvent) => void): Promise<PluginListenerHandle>
}

const MeshRadio = registerPlugin<MeshRadioPlugin>('MeshRadio')

export function isCapacitorRadioAvailable(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('MeshRadio')
}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    // Плагин отказывает «код: подробности», как команды десктопа.
    throw radioErrorFrom(e)
  }
}

// ─── Поток событий ────────────────────────────────────────────────────────

type Handler = (ev: RadioEvent) => void

const handlers = new Map<number, Handler>()
/** События соединений, чьи объекты ещё не готовы. */
const early = new Map<number, RadioEvent[]>()
let listening: Promise<void> | null = null

function listen(): Promise<void> {
  listening ??= MeshRadio.addListener('radio', (ev) => {
    const handler = handlers.get(ev.link)
    if (handler) handler(ev)
    else {
      const list = early.get(ev.link) ?? []
      if (list.length < 1000) list.push(ev)
      early.set(ev.link, list)
    }
  }).then(() => undefined)
  return listening
}

function attach(id: number, handler: Handler): void {
  handlers.set(id, handler)
  const pending = early.get(id)
  early.delete(id)
  for (const ev of pending ?? []) handler(ev)
}

// ─── Уведомления ──────────────────────────────────────────────────────────

let appActive = true
let appStateWatched = false
let noticeSet = false
let notificationsAsked = false

function watchAppState(): void {
  if (appStateWatched) return
  appStateWatched = true
  void App.addListener('appStateChange', ({ isActive }) => {
    appActive = isActive
  })
}

/** Тексты постоянного уведомления службы — на языке интерфейса. */
async function prepareForeground(): Promise<void> {
  watchAppState()
  if (!noticeSet) {
    noticeSet = true
    await MeshRadio.setNotice({
      title: t('mesh.android.serviceTitle'),
      text: t('mesh.android.serviceText'),
      channel: t('mesh.android.serviceChannel'),
    }).catch(() => {})
  }
  if (!notificationsAsked) {
    notificationsAsked = true
    // Android 13+: без разрешения не будет уведомлений о сообщениях в фоне.
    await MeshRadio.requestNotifications().catch(() => {})
  }
}

/** Уведомление о сообщении по радио — если приложение сейчас в фоне. */
export function showMessageNotification(title: string, body: string): void {
  if (appActive) return
  void MeshRadio.showMessage({
    title,
    body,
    tag: 'mesh',
    channel: t('mesh.android.messagesChannel'),
  }).catch(() => {})
}

// ─── Соединения ───────────────────────────────────────────────────────────

class LinkState {
  id = 0
  closed = false
  closeReason: CloseReason = null
  private readonly closeCbs = new Set<(r: CloseReason) => void>()

  onClose(cb: (r: CloseReason) => void): Unsubscribe {
    if (this.closed && this.closeReason !== null) queueMicrotask(() => cb(this.closeReason))
    this.closeCbs.add(cb)
    return () => this.closeCbs.delete(cb)
  }

  markClosed(reason: CloseReason): void {
    if (this.closed) return
    this.closed = true
    this.closeReason = reason
    handlers.delete(this.id)
    for (const cb of [...this.closeCbs]) cb(reason)
  }
}

class CapacitorByteLink implements ByteLink {
  readonly state = new LinkState()
  private readonly dataCbs = new Set<(d: Uint8Array) => void>()
  private backlog: Uint8Array[] = []

  constructor(
    readonly kind: 'serial' | 'tcp',
    readonly label: string
  ) {}

  handle(ev: RadioEvent): void {
    if (ev.kind === 'data' && ev.bytes) {
      const bytes = fromBase64(ev.bytes)
      if (this.dataCbs.size === 0) this.backlog.push(bytes)
      else for (const cb of [...this.dataCbs]) cb(bytes)
    } else if (ev.kind === 'closed') {
      this.state.markClosed(ev.reason ?? 'device_lost')
    }
  }

  async write(data: Uint8Array): Promise<void> {
    if (this.state.closed) throw radioErrorFrom('link_not_found: closed')
    await call(() => MeshRadio.write({ link: this.state.id, data: toBase64(data) }))
  }

  onData(cb: (d: Uint8Array) => void): Unsubscribe {
    this.dataCbs.add(cb)
    if (this.backlog.length > 0) {
      const pending = this.backlog
      this.backlog = []
      for (const chunk of pending) cb(chunk)
    }
    return () => this.dataCbs.delete(cb)
  }

  onClose(cb: (r: CloseReason) => void): Unsubscribe {
    return this.state.onClose(cb)
  }

  async close(): Promise<void> {
    if (this.state.closed) return
    this.state.closed = true
    handlers.delete(this.state.id)
    await MeshRadio.close({ link: this.state.id }).catch(() => {})
  }
}

class CapacitorGattLink implements GattLink {
  readonly kind = 'ble' as const
  readonly state = new LinkState()
  private readonly notifyCbs = new Map<string, Set<(d: Uint8Array) => void>>()

  constructor(readonly label: string) {}

  handle(ev: RadioEvent): void {
    if (ev.kind === 'notify' && ev.characteristic) {
      const cbs = this.notifyCbs.get(ev.characteristic.toLowerCase())
      if (!cbs) return
      const bytes = fromBase64(ev.bytes ?? '')
      for (const cb of [...cbs]) cb(bytes)
    } else if (ev.kind === 'closed') {
      this.state.markClosed(ev.reason ?? 'device_lost')
    }
  }

  async write(characteristic: string, data: Uint8Array, withResponse = true): Promise<void> {
    if (this.state.closed) throw radioErrorFrom('link_not_found: closed')
    await call(() =>
      MeshRadio.bleWrite({
        link: this.state.id,
        characteristic,
        data: toBase64(data),
        withResponse,
      })
    )
  }

  async read(characteristic: string): Promise<Uint8Array> {
    const { data } = await call(() => MeshRadio.bleRead({ link: this.state.id, characteristic }))
    return fromBase64(data)
  }

  async subscribe(characteristic: string, cb: (d: Uint8Array) => void): Promise<Unsubscribe> {
    const key = characteristic.trim().toLowerCase()
    let set = this.notifyCbs.get(key)
    if (!set) {
      set = new Set()
      this.notifyCbs.set(key, set)
    }
    set.add(cb)
    try {
      await call(() => MeshRadio.bleSubscribe({ link: this.state.id, characteristic: key }))
    } catch (e) {
      set.delete(cb)
      throw e
    }
    return () => set.delete(cb)
  }

  onClose(cb: (r: CloseReason) => void): Unsubscribe {
    return this.state.onClose(cb)
  }

  async close(): Promise<void> {
    if (this.state.closed) return
    this.state.closed = true
    handlers.delete(this.state.id)
    await MeshRadio.close({ link: this.state.id }).catch(() => {})
  }
}

export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  const { ports } = await call(() => MeshRadio.serialPorts())
  return ports
}

export async function openSerial(path: string, baud?: number): Promise<ByteLink> {
  await listen()
  await prepareForeground()
  const link = new CapacitorByteLink('serial', path)
  const { link: id } = await call(() => MeshRadio.serialOpen({ path, baud }))
  link.state.id = id
  attach(id, (ev) => link.handle(ev))
  return link
}

export async function openTcp(host: string, port: number): Promise<ByteLink> {
  await listen()
  await prepareForeground()
  const link = new CapacitorByteLink('tcp', `${host}:${port}`)
  const { link: id } = await call(() => MeshRadio.tcpOpen({ host, port }))
  link.state.id = id
  attach(id, (ev) => link.handle(ev))
  return link
}

export async function scanBle(services: string[], timeoutMs = 4000): Promise<BleDeviceInfo[]> {
  const { devices } = await call(() => MeshRadio.bleScan({ services, timeoutMs }))
  return devices
}

export async function connectBle(id: string, label?: string): Promise<GattLink> {
  await listen()
  await prepareForeground()
  const link = new CapacitorGattLink(label || id)
  const { link: linkId } = await call(() => MeshRadio.bleConnect({ id }))
  link.state.id = linkId
  attach(linkId, (ev) => link.handle(ev))
  return link
}
