/**
 * Узел Reticulum в десктопе: команды `rns_*` (src-tauri/src/rns). Сам стек
 * (rns-net + lxmf-rs) живёт в Rust; сюда приходят события — announce,
 * сообщения LXMF, их судьба, состояние интерфейсов — через Tauri Channel,
 * только этому окну.
 */

import type { Channel } from '@tauri-apps/api/core'
import { radioErrorFrom } from '../radio/types'

/** Интерфейс Reticulum: хаб сообщества по TCP, LAN или RNode по USB. */
export type RnsInterface =
  | { kind: 'tcp'; host: string; port: number }
  | { kind: 'auto' }
  | {
      kind: 'rnode'
      port: string
      frequency: number
      bandwidth: number
      spreadingFactor: number
      codingRate: number
      txPower: number
    }

export type RnsMethod = 'auto' | 'opportunistic' | 'direct' | 'propagated'

export interface RnsStartOptions {
  /** 64 байта: X25519 + Ed25519 (identity.ts). */
  identity: Uint8Array
  displayName: string
  interfaces: RnsInterface[]
  /** Узел доставки (propagation node) для офлайн-сообщений, hex. */
  propagationNode: string | null
}

export interface RnsStarted {
  /** Адрес LXMF (delivery destination), 16 байт hex — его дают собеседникам. */
  address: string
  identityHash: string
}

export interface RnsInterfaceStatus {
  name: string
  kind: RnsInterface['kind']
  /** false — не поднялся при старте (хаб недоступен, RNode не подключён); узел его больше не пробует. */
  started?: boolean
  online: boolean
  rxBytes: number
  txBytes: number
}

export interface RnsStatus {
  running: boolean
  interfaces: RnsInterfaceStatus[]
  paths: number
  propagationNode: string | null
}

export type RnsAspect = 'lxmf.delivery' | 'lxmf.propagation' | 'nomadnetwork.node'

export type RnsEvent =
  | {
      kind: 'announce'
      aspect: RnsAspect
      dest: string
      identity: string
      name: string | null
      hops: number | null
      /** Когда услышан, секунды; у адресов из прошлых запусков — давно. */
      heard?: number | null
    }
  | {
      kind: 'message'
      id: string
      from: string
      title: string
      content: string
      /** Секунды по часам отправителя. */
      timestamp: number
      signed: boolean
      method: string
    }
  | {
      kind: 'state'
      id: string
      state: 'sending' | 'sent' | 'delivered' | 'failed'
      reason?: string
    }
  | { kind: 'interface'; name: string; online: boolean }
  | {
      kind: 'sync'
      state: 'idle' | 'requesting' | 'receiving' | 'done' | 'failed'
      received: number
    }

/** Свой узел есть в десктопе, кроме Windows: rns-net там не собирается. */
export function isRnsAvailable(): boolean {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return false
  return !/windows/i.test(navigator.userAgent || '')
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  try {
    return await tauriInvoke<T>(cmd, args)
  } catch (e) {
    throw radioErrorFrom(e)
  }
}

export async function rnsStart(
  options: RnsStartOptions,
  onEvent: (ev: RnsEvent) => void
): Promise<RnsStarted> {
  const { Channel: TauriChannel } = await import('@tauri-apps/api/core')
  const channel: Channel<RnsEvent> = new TauriChannel<RnsEvent>()
  channel.onmessage = onEvent
  return invoke<RnsStarted>('rns_start', {
    options: {
      identity: Array.from(options.identity),
      displayName: options.displayName,
      interfaces: options.interfaces,
      propagationNode: options.propagationNode,
    },
    onEvent: channel,
  })
}

export const rnsStop = (): Promise<void> => invoke('rns_stop')
export const rnsStatus = (): Promise<RnsStatus> => invoke('rns_status')
export const rnsAnnounce = (): Promise<void> => invoke('rns_announce')

export const rnsSend = (to: string, content: string, method: RnsMethod = 'auto', title = '') =>
  invoke<{ id: string }>('rns_send', { to, content, title, method })

export const rnsRequestPath = (to: string): Promise<void> => invoke('rns_request_path', { to })

export const rnsSetPropagationNode = (hash: string | null): Promise<void> =>
  invoke('rns_set_propagation_node', { hash })

export const rnsSync = (): Promise<void> => invoke('rns_sync')

/** Страница NomadNet: запрос `path` у узла по Link; ответ — micron или файл. */
export const rnsPage = (node: string, path: string, data: Record<string, string> = {}) =>
  invoke<{ content: string; binary: boolean }>('rns_page', { node, path, data })
