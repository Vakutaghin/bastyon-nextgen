/**
 * Транспорт до радио в десктопе: команды `radio_*` (src-tauri/src/radio).
 *
 * События соединения приходят через Tauri `Channel` — только этому окну.
 * Данные могут прийти раньше, чем протокол подпишется (устройство ответило
 * сразу после открытия порта), поэтому до первой подписки они копятся.
 */

import type { Channel } from '@tauri-apps/api/core'
import {
  radioErrorFrom,
  type BleDeviceInfo,
  type ByteLink,
  type CloseReason,
  type GattLink,
  type SerialPortInfo,
  type Unsubscribe,
} from './types'

type RustEvent =
  | { kind: 'data'; bytes: number[] }
  | { kind: 'notify'; characteristic: string; bytes: number[] }
  | { kind: 'closed'; reason: string | null }

export function isTauriRadioAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  try {
    return await tauriInvoke<T>(cmd, args)
  } catch (e) {
    throw radioErrorFrom(e)
  }
}

async function newChannel(onEvent: (ev: RustEvent) => void): Promise<Channel<RustEvent>> {
  const { Channel: TauriChannel } = await import('@tauri-apps/api/core')
  const channel = new TauriChannel<RustEvent>()
  channel.onmessage = onEvent
  return channel
}

/** UUID так, как их отдаёт Rust: строчными буквами. */
export function normalizeUuid(uuid: string): string {
  return uuid.trim().toLowerCase()
}

/** Общая часть соединения: закрытие и события. */
class LinkState {
  id = 0
  closed = false
  closeReason: CloseReason = null
  private readonly closeCbs = new Set<(r: CloseReason) => void>()

  onClose(cb: (r: CloseReason) => void): Unsubscribe {
    if (this.closed && this.closeReason !== null) {
      // Соединение уже пропало — сообщаем сразу, иначе подписчик ждал бы вечно.
      queueMicrotask(() => cb(this.closeReason))
    }
    this.closeCbs.add(cb)
    return () => this.closeCbs.delete(cb)
  }

  markClosed(reason: CloseReason): void {
    if (this.closed) return
    this.closed = true
    this.closeReason = reason
    for (const cb of [...this.closeCbs]) cb(reason)
  }
}

class TauriByteLink implements ByteLink {
  readonly state = new LinkState()
  private readonly dataCbs = new Set<(d: Uint8Array) => void>()
  private backlog: Uint8Array[] = []

  constructor(
    readonly kind: 'serial' | 'tcp',
    readonly label: string
  ) {}

  handle(ev: RustEvent): void {
    if (ev.kind === 'data') {
      const bytes = Uint8Array.from(ev.bytes)
      if (this.dataCbs.size === 0) this.backlog.push(bytes)
      else for (const cb of [...this.dataCbs]) cb(bytes)
    } else if (ev.kind === 'closed') {
      this.state.markClosed(ev.reason ?? 'device_lost')
    }
  }

  async write(data: Uint8Array): Promise<void> {
    if (this.state.closed) throw radioErrorFrom('link_not_found: closed')
    await invoke('radio_write', { link: this.state.id, data: Array.from(data) })
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
    await invoke('radio_close', { link: this.state.id }).catch(() => {})
  }
}

class TauriGattLink implements GattLink {
  readonly kind = 'ble' as const
  readonly state = new LinkState()
  private readonly notifyCbs = new Map<string, Set<(d: Uint8Array) => void>>()

  constructor(readonly label: string) {}

  handle(ev: RustEvent): void {
    if (ev.kind === 'notify') {
      const cbs = this.notifyCbs.get(normalizeUuid(ev.characteristic))
      if (!cbs) return
      const bytes = Uint8Array.from(ev.bytes)
      for (const cb of [...cbs]) cb(bytes)
    } else if (ev.kind === 'closed') {
      this.state.markClosed(ev.reason ?? 'device_lost')
    }
  }

  async write(characteristic: string, data: Uint8Array, withResponse = true): Promise<void> {
    if (this.state.closed) throw radioErrorFrom('link_not_found: closed')
    await invoke('radio_ble_write', {
      link: this.state.id,
      characteristic,
      data: Array.from(data),
      withResponse,
    })
  }

  async read(characteristic: string): Promise<Uint8Array> {
    const bytes = await invoke<number[]>('radio_ble_read', {
      link: this.state.id,
      characteristic,
    })
    return Uint8Array.from(bytes)
  }

  async subscribe(characteristic: string, cb: (d: Uint8Array) => void): Promise<Unsubscribe> {
    const key = normalizeUuid(characteristic)
    let set = this.notifyCbs.get(key)
    if (!set) {
      set = new Set()
      this.notifyCbs.set(key, set)
    }
    set.add(cb)
    try {
      await invoke('radio_ble_subscribe', { link: this.state.id, characteristic: key })
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
    await invoke('radio_close', { link: this.state.id }).catch(() => {})
  }
}

export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  return invoke<SerialPortInfo[]>('radio_serial_ports')
}

export async function openSerial(path: string, baud?: number): Promise<ByteLink> {
  const link = new TauriByteLink('serial', path)
  const channel = await newChannel((ev) => link.handle(ev))
  link.state.id = await invoke<number>('radio_serial_open', { path, baud, onEvent: channel })
  return link
}

export async function openTcp(host: string, port: number): Promise<ByteLink> {
  const link = new TauriByteLink('tcp', `${host}:${port}`)
  const channel = await newChannel((ev) => link.handle(ev))
  link.state.id = await invoke<number>('radio_tcp_open', { host, port, onEvent: channel })
  return link
}

export async function scanBle(services: string[], timeoutMs = 4000): Promise<BleDeviceInfo[]> {
  return invoke<BleDeviceInfo[]>('radio_ble_scan', { services, timeoutMs })
}

export async function connectBle(id: string, label?: string): Promise<GattLink> {
  const link = new TauriGattLink(label || id)
  const channel = await newChannel((ev) => link.handle(ev))
  link.state.id = await invoke<number>('radio_ble_connect', { id, onEvent: channel })
  return link
}
