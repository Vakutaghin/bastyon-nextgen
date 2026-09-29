/**
 * Открыть соединение с радио по выбору пользователя: порт USB-serial, адрес в
 * локальной сети или устройство Bluetooth — под протокол нужной сети
 * (кадры MeshCore или пакеты Meshtastic). Отдельный модуль, чтобы тесты
 * сторов подменяли радио поддельным.
 */

import { DEFAULT_BAUD } from '../meshcore/constants'
import { frameLinkFromGatt, frameLinkFromStream, type FrameLink } from '../meshcore/framing'
import { DEFAULT_BAUD as MT_BAUD } from '../meshtastic/constants'
import { packetLinkFromGatt, packetLinkFromStream, type PacketLink } from '../meshtastic/framing'
import { connectBle, isTauriRadioAvailable, openSerial, openTcp } from './tauri-radio'
import { RadioError, type ByteLink, type GattLink } from './types'

export type MeshTarget =
  | { transport: 'serial'; path: string; label?: string | null }
  | { transport: 'tcp'; host: string; port: number }
  | { transport: 'ble'; id: string; name?: string | null }

export interface RadioAvailability {
  serial: boolean
  tcp: boolean
  ble: boolean
}

/** Какие способы подключения есть в этой сборке. Пока — только десктоп. */
export function radioAvailability(): RadioAvailability {
  const tauri = isTauriRadioAvailable()
  return { serial: tauri, tcp: tauri, ble: tauri }
}

export function targetLabel(target: MeshTarget): string {
  switch (target.transport) {
    case 'serial':
      return target.label || target.path
    case 'tcp':
      return `${target.host}:${target.port}`
    case 'ble':
      return target.name || target.id
  }
}

/** Транспорт до радио: поток байтов (USB, TCP) или GATT (Bluetooth). */
async function openRaw(
  target: MeshTarget,
  baud: number
): Promise<{ stream: ByteLink } | { gatt: GattLink }> {
  if (!isTauriRadioAvailable()) throw new RadioError('unsupported')
  switch (target.transport) {
    case 'serial':
      return { stream: await openSerial(target.path, baud) }
    case 'tcp':
      return { stream: await openTcp(target.host, target.port) }
    case 'ble':
      return { gatt: await connectBle(target.id, target.name ?? undefined) }
  }
}

/** Радио MeshCore: кадры companion-протокола. */
export async function openFrameLink(target: MeshTarget): Promise<FrameLink> {
  const raw = await openRaw(target, DEFAULT_BAUD)
  if ('stream' in raw) return frameLinkFromStream(raw.stream)
  try {
    return await frameLinkFromGatt(raw.gatt)
  } catch (e) {
    await raw.gatt.close()
    throw e
  }
}

/** Радио Meshtastic: пакеты ToRadio/FromRadio. */
export async function openPacketLink(target: MeshTarget): Promise<PacketLink> {
  const raw = await openRaw(target, MT_BAUD)
  if ('stream' in raw) return packetLinkFromStream(raw.stream)
  try {
    return await packetLinkFromGatt(raw.gatt)
  } catch (e) {
    await raw.gatt.close()
    throw e
  }
}
