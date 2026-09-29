/**
 * Общее у сторов подключённых радио (MeshCore, Meshtastic): переподключение,
 * коды ошибок для интерфейса, последнее устройство аккаунта.
 */

import { MESH_LAST_DEVICE_PREFIX } from '@/blockchain/constants/storage'
import type { MeshNetwork } from '../ids'
import type { MeshTarget } from '../radio/open-link'
import { radioErrorFrom } from '../radio/types'

export type MeshConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'

/** Паузы между попытками переподключения после обрыва, мс. */
export const RECONNECT_DELAYS = [2_000, 5_000, 15_000, 30_000]

/** Код ошибки для интерфейса (`mesh.errors.<код>`). */
export function meshErrorCode(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code: unknown }).code
    const message = e instanceof Error ? e.message : ''
    // Отказ с названной причиной (channels_full, channel_not_found) — по причине.
    if (code === 'rejected' && /^[a-z_]+$/.test(message) && message !== 'rejected') return message
    // Радио молчит — чаще всего на нём другая прошивка.
    if (code === 'timeout') return 'no_answer'
    if (typeof code === 'string') return code
  }
  return radioErrorFrom(e).code
}

// ─── Последнее радио аккаунта ─────────────────────────────────────────────
// Один ключ на аккаунт (его чистят при выходе и удалении аккаунта):
// `{ meshcore?: MeshTarget, meshtastic?: MeshTarget }`. Раньше там лежало
// одно радио MeshCore — такую запись читаем как радио MeshCore.

type LastDevices = Partial<Record<MeshNetwork, MeshTarget>>

function keyOf(address: string): string {
  return `${MESH_LAST_DEVICE_PREFIX}${address}`
}

function isTarget(t: unknown): t is MeshTarget {
  if (!t || typeof t !== 'object') return false
  const kind = (t as { transport?: unknown }).transport
  return kind === 'serial' || kind === 'tcp' || kind === 'ble'
}

function readAll(address: string): LastDevices {
  try {
    const raw = localStorage.getItem(keyOf(address))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (isTarget(parsed)) return { meshcore: parsed }
    if (!parsed || typeof parsed !== 'object') return {}
    const out: LastDevices = {}
    for (const [network, target] of Object.entries(parsed as Record<string, unknown>)) {
      if ((network === 'meshcore' || network === 'meshtastic') && isTarget(target)) {
        out[network] = target
      }
    }
    return out
  } catch {
    return {} // повреждённая запись — как будто её нет
  }
}

export function loadLastDevice(address: string | null, network: MeshNetwork): MeshTarget | null {
  if (!address) return null
  return readAll(address)[network] ?? null
}

export function saveLastDevice(
  address: string | null,
  network: MeshNetwork,
  target: MeshTarget
): void {
  if (!address) return
  try {
    const all = readAll(address)
    all[network] = target
    localStorage.setItem(keyOf(address), JSON.stringify(all))
  } catch {
    /* нет localStorage — просто не запомним */
  }
}
