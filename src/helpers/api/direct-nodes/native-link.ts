/**
 * Запрос к ноде напрямую, по её TLS-порту (38881). Сертификаты у нод
 * самоподписанные («Pocketnet node», у каждой свой), WebView такой не примет,
 * поэтому запрос идёт мимо него: в десктопе — Rust (`node_fetch`), на
 * Android — плагин NodeLink. Нативная сторона сверяет сертификат с
 * запомненным (`pin`) ещё до отправки запроса и возвращает отпечаток того,
 * что увидела, — его запоминает `node-pins.ts`.
 */

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { isTauriEnv, raceWithAbort } from '../request-tor'

export interface NodeLinkRequest {
  host: string
  port: number
  path: '/public/' | '/post/'
  body: string
  /** SHA-256 сертификата ноды, hex; null — первая встреча. */
  pin: string | null
  timeoutMs: number
  signal?: AbortSignal
}

export interface NodeLinkResponse {
  status: number
  body: string
  /** SHA-256 сертификата, который показала нода, hex. */
  fingerprint: string
}

/** Нода показала не тот сертификат, что в прошлый раз. */
export class NodePinMismatchError extends Error {
  override readonly name = 'NodePinMismatchError'
  constructor(readonly host: string) {
    super(`node ${host}: certificate changed`)
  }
}

interface NodeLinkPlugin {
  request(options: {
    id: string
    url: string
    body: string
    pin: string | null
    timeoutMs: number
  }): Promise<NodeLinkResponse>
  cancel(options: { id: string }): Promise<void>
  wsConnect(options: { id: string; url: string; pin: string | null }): Promise<{
    fingerprint: string
  }>
  wsSend(options: { id: string; data: string }): Promise<void>
  wsClose(options: { id: string }): Promise<void>
  addListener(
    event: 'wsMessage',
    fn: (e: { id: string; data: string }) => void
  ): Promise<PluginListenerHandle>
  addListener(
    event: 'wsClose',
    fn: (e: { id: string; code?: number; reason?: string }) => void
  ): Promise<PluginListenerHandle>
}

/** Плагин Android (android/…/plugins/NodeLinkPlugin.java): запросы и сокет. */
export const NodeLink = registerPlugin<NodeLinkPlugin>('NodeLink')

/** Ошибка нативной стороны при чужом сертификате. */
const PIN_MISMATCH = 'pin_mismatch'

function isAndroidLink(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NodeLink')
}

/** Прямое подключение есть только в приложениях: в браузере его не сделать. */
export function isNodeLinkAvailable(): boolean {
  return isTauriEnv() || isAndroidLink()
}

let counter = 0

export async function nodeLinkRequest(req: NodeLinkRequest): Promise<NodeLinkResponse> {
  if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const url = `https://${req.host}:${req.port}${req.path}`

  if (isTauriEnv()) {
    const { invoke } = await import('@tauri-apps/api/core')
    try {
      return await raceWithAbort(
        invoke<NodeLinkResponse>('node_fetch', {
          req: { url, body: req.body, pin: req.pin, timeout_ms: req.timeoutMs },
        }),
        req.signal
      )
    } catch (e) {
      if (String(e).startsWith(PIN_MISMATCH)) throw new NodePinMismatchError(req.host)
      throw e
    }
  }

  if (isAndroidLink()) {
    const id = `n${Date.now().toString(36)}-${++counter}`
    const pending = NodeLink.request({
      id,
      url,
      body: req.body,
      pin: req.pin,
      timeoutMs: req.timeoutMs,
    })
    try {
      return await raceWithAbort(pending, req.signal)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        void NodeLink.cancel({ id }).catch(() => {})
        pending.catch(() => {})
        throw e
      }
      if ((e as { code?: unknown } | null)?.code === PIN_MISMATCH) {
        throw new NodePinMismatchError(req.host)
      }
      throw e
    }
  }

  throw new Error('direct node connection is not available here')
}
