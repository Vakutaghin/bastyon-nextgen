/**
 * Открыть соединение с радио MeshCore по выбору пользователя: порт USB-serial,
 * адрес в локальной сети или устройство Bluetooth. Отдельный модуль, чтобы
 * тесты стора подменяли радио поддельным.
 */

import { DEFAULT_BAUD } from '../meshcore/constants'
import { frameLinkFromGatt, frameLinkFromStream, type FrameLink } from '../meshcore/framing'
import { connectBle, isTauriRadioAvailable, openSerial, openTcp } from './tauri-radio'
import { RadioError } from './types'

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

export async function openFrameLink(target: MeshTarget): Promise<FrameLink> {
  if (!isTauriRadioAvailable()) throw new RadioError('unsupported')
  switch (target.transport) {
    case 'serial':
      return frameLinkFromStream(await openSerial(target.path, DEFAULT_BAUD))
    case 'tcp':
      return frameLinkFromStream(await openTcp(target.host, target.port))
    case 'ble': {
      const gatt = await connectBle(target.id, target.name ?? undefined)
      try {
        return await frameLinkFromGatt(gatt)
      } catch (e) {
        await gatt.close()
        throw e
      }
    }
  }
}
