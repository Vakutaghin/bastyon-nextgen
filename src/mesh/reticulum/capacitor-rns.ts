/**
 * Узел Reticulum на Android: плагин MeshRns
 * (android/app/src/main/java/com/bastyon/app/plugins/radio/MeshRnsPlugin.java)
 * с тем же узлом на Rust, что у десктопа (src-tauri/crates/bastyon-rns). Те
 * же команды и события, что у `rns_*` десктопа; события приходят потоком
 * `rns`.
 *
 * Пока узел работает, висит постоянное уведомление — иначе Android усыпит
 * приложение в фоне.
 */

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { t } from '@/i18n'
import { radioErrorFrom } from '../radio/types'
import type {
  RnsAttachment,
  RnsDownload,
  RnsEvent,
  RnsMethod,
  RnsStartOptions,
  RnsStarted,
  RnsStatus,
} from './rns-api'

interface MeshRnsPlugin {
  available(): Promise<{ available: boolean }>
  setNotice(o: { title: string; text: string; channel: string }): Promise<void>
  start(o: { options: Record<string, unknown> }): Promise<RnsStarted>
  stop(): Promise<void>
  status(): Promise<RnsStatus>
  announce(): Promise<void>
  send(o: {
    to: string
    content: string
    title: string
    method: RnsMethod
    attachments: RnsAttachment[]
  }): Promise<{ id: string }>
  paper(o: { to: string; content: string }): Promise<{ uri: string }>
  ingest(o: { uri: string }): Promise<void>
  requestPath(o: { to: string }): Promise<void>
  setPropagationNode(o: { hash: string | null }): Promise<void>
  sync(): Promise<void>
  page(o: {
    node: string
    path: string
    data: Record<string, string>
  }): Promise<{ content: string; binary: boolean }>
  download(o: { node: string; path: string }): Promise<RnsDownload>
  addListener(event: 'rns', cb: (ev: RnsEvent) => void): Promise<PluginListenerHandle>
}

const MeshRns = registerPlugin<MeshRnsPlugin>('MeshRns')

export function isCapacitorRnsAvailable(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('MeshRns')
}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    // Плагин отказывает «код: подробности», как команды десктопа.
    throw radioErrorFrom(e)
  }
}

let listener: PluginListenerHandle | null = null

export async function start(
  options: RnsStartOptions,
  onEvent: (ev: RnsEvent) => void
): Promise<RnsStarted> {
  await listener?.remove()
  listener = await MeshRns.addListener('rns', onEvent)
  await MeshRns.setNotice({
    title: t('mesh.android.rnsServiceTitle'),
    text: t('mesh.android.rnsServiceText'),
    channel: t('mesh.android.serviceChannel'),
  }).catch(() => {})
  return call(() =>
    MeshRns.start({
      options: {
        identity: Array.from(options.identity),
        displayName: options.displayName,
        interfaces: options.interfaces,
        propagationNode: options.propagationNode,
      },
    })
  )
}

export async function stop(): Promise<void> {
  await call(() => MeshRns.stop())
  await listener?.remove()
  listener = null
}

export const status = (): Promise<RnsStatus> => call(() => MeshRns.status())
export const announce = (): Promise<void> => call(() => MeshRns.announce())

export const send = (
  to: string,
  content: string,
  method: RnsMethod,
  title: string,
  attachments: RnsAttachment[] = []
) => call(() => MeshRns.send({ to, content, title, method, attachments }))

export const paper = (to: string, content: string) => call(() => MeshRns.paper({ to, content }))

export const ingest = (uri: string): Promise<void> => call(() => MeshRns.ingest({ uri }))

export const requestPath = (to: string): Promise<void> => call(() => MeshRns.requestPath({ to }))

export const setPropagationNode = (hash: string | null): Promise<void> =>
  call(() => MeshRns.setPropagationNode({ hash }))

export const sync = (): Promise<void> => call(() => MeshRns.sync())

export const page = (node: string, path: string, data: Record<string, string>) =>
  call(() => MeshRns.page({ node, path, data }))

export const download = (node: string, path: string) => call(() => MeshRns.download({ node, path }))
