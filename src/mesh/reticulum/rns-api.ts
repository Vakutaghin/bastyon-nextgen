/**
 * Узел Reticulum: на десктопе — команды `rns_*` (src-tauri/src/rns), на
 * Android — плагин MeshRns (capacitor-rns.ts). Сам стек (rns-net + lxmf-rs,
 * src-tauri/crates/bastyon-rns) один и тот же, в Rust; сюда приходят события —
 * announce, сообщения LXMF, их судьба, состояние интерфейсов (на десктопе —
 * через Tauri Channel, только этому окну).
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

/** Вложение LXMF (как у Sideband и MeshChat): байты — в base64. */
export interface RnsAttachment {
  kind: 'image' | 'file' | 'audio'
  name: string
  mime: string
  data: string
}

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

/** Путь из таблицы путей узла (обзор сети). */
export interface RnsPath {
  dest: string
  hops: number
  /** Следующий транспортный узел (hex identity), если путь не прямой. */
  via: string | null
  /** Наш интерфейс (имя из настроек), откуда пришёл путь. */
  interface: string
  kind: RnsInterface['kind'] | ''
  /** Секунды Unix. */
  updated: number
  expires: number
}

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
      attachments?: RnsAttachment[]
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
  /** Ход ответа узла NomadNet, который идёт ресурсом: частей из скольких. */
  | { kind: 'progress'; received: number; total: number }

/** Чем кончилось скачивание файла NomadNet. */
export type RnsDownload =
  | { kind: 'saved'; name: string; size: number }
  | { kind: 'cancelled' }
  /** Узел ответил страницей (например, отказом). */
  | { kind: 'page'; content: string; binary: boolean }

function onAndroid(): boolean {
  const cap = (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor
  return cap?.getPlatform?.() === 'android'
}

/** Свой узел есть в десктопе (кроме Windows: rns-net там не собирается) и на Android. */
export function isRnsAvailable(): boolean {
  if (typeof window === 'undefined') return false
  if ('__TAURI_INTERNALS__' in window) return !/windows/i.test(navigator.userAgent || '')
  return onAndroid()
}

async function android() {
  const mod = await import('./capacitor-rns')
  if (!mod.isCapacitorRnsAvailable()) throw radioErrorFrom(new Error('unsupported'))
  return mod
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
  if (onAndroid()) return (await android()).start(options, onEvent)
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

export const rnsStop = async (): Promise<void> =>
  onAndroid() ? (await android()).stop() : invoke('rns_stop')

export const rnsStatus = async (): Promise<RnsStatus> =>
  onAndroid() ? (await android()).status() : invoke('rns_status')

export const rnsAnnounce = async (): Promise<void> =>
  onAndroid() ? (await android()).announce() : invoke('rns_announce')

/** Обзор сети: куда узел знает дорогу, через кого и по какому интерфейсу. */
export const rnsPaths = async (): Promise<RnsPath[]> =>
  onAndroid() ? (await android()).paths() : invoke('rns_paths')

export const rnsSend = async (
  to: string,
  content: string,
  method: RnsMethod = 'auto',
  title = '',
  attachments: RnsAttachment[] = []
): Promise<{ id: string }> =>
  onAndroid()
    ? (await android()).send(to, content, method, title, attachments)
    : invoke('rns_send', { to, content, title, method, attachments })

/** Бумажное сообщение адресату: ссылка `lxm://` для QR-кода или текста. */
export const rnsPaper = async (to: string, content: string): Promise<{ uri: string }> =>
  onAndroid() ? (await android()).paper(to, content) : invoke('rns_paper', { to, content })

/** Открыть бумажное сообщение (`lxm://…`): оно придёт событием `message`. */
export const rnsIngest = async (uri: string): Promise<void> =>
  onAndroid() ? (await android()).ingest(uri) : invoke('rns_ingest', { uri })

export const rnsRequestPath = async (to: string): Promise<void> =>
  onAndroid() ? (await android()).requestPath(to) : invoke('rns_request_path', { to })

export const rnsSetPropagationNode = async (hash: string | null): Promise<void> =>
  onAndroid()
    ? (await android()).setPropagationNode(hash)
    : invoke('rns_set_propagation_node', { hash })

export const rnsSync = async (): Promise<void> =>
  onAndroid() ? (await android()).sync() : invoke('rns_sync')

/** Страница NomadNet: запрос `path` у узла по Link; ответ — micron или файл. */
export const rnsPage = async (
  node: string,
  path: string,
  data: Record<string, string> = {}
): Promise<{ content: string; binary: boolean }> =>
  onAndroid() ? (await android()).page(node, path, data) : invoke('rns_page', { node, path, data })

/**
 * Файл NomadNet (`/file/…`): узел отдаёт его по Link, затем системное окно
 * «Сохранить как». Ход — событиями `progress`.
 */
export const rnsDownload = async (node: string, path: string): Promise<RnsDownload> =>
  onAndroid() ? (await android()).download(node, path) : invoke('rns_download', { node, path })
