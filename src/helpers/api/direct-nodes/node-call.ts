/**
 * Один вызов метода у одной ноды напрямую: параметры приводятся к типам, как
 * у прокси, сертификат сверяется с запомненным, ответ ноды
 * (`{result, error, id}`) разбирается в результат или ошибку.
 */

import servers from '@/servers.json'
import { NodePinMismatchError, nodeLinkRequest } from './native-link'
import { pinOf, rememberPin } from './node-pins'
import { coerceParams, nodePath } from './rpc-spec'

export const NODE_PORT = servers.servers.production.nodes.port
export const NODE_WSS_PORT = servers.servers.production.nodes.wss

/**
 * Нода недоступна или не смогла ответить — стоит спросить другую. `busy` —
 * нода жива, но её очередь переполнена: из рабочих её не убираем.
 */
export class NodeTransportError extends Error {
  override readonly name = 'NodeTransportError'
  constructor(
    readonly host: string,
    message: string,
    options?: { cause?: unknown; busy?: boolean }
  ) {
    super(`node ${host}: ${message}`, options)
    this.busy = options?.busy === true
  }
  readonly busy: boolean
}

/** Ошибка, после которой стоит спросить другую ноду. */
export function isNodeTransportError(error: unknown): boolean {
  return error instanceof NodeTransportError || error instanceof NodePinMismatchError
}

interface NodeReply {
  result?: unknown
  error?: { code?: unknown; message?: unknown } | null
}

export interface NodeCallOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Результат метода (`result` ответа ноды). Ошибка ноды бросается её объектом
 * `{code, message}` с `httpStatus` — так же, как её пересылает прокси, и
 * дальше её разбирают те же функции (rpc-errors, node-reject).
 */
export async function nodeCall(
  host: string,
  method: string,
  params: unknown,
  options: NodeCallOptions = {}
): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const endpoint = `${host}:${NODE_PORT}`
  // Вне try: ошибка здесь — наша, а не ноды, и в сбой связи её не превращаем.
  const body = JSON.stringify({ method, params: coerceParams(method, params) })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort, { once: true })

  let reply: { status: number; body: string; fingerprint: string }
  try {
    reply = await nodeLinkRequest({
      host,
      port: NODE_PORT,
      path: nodePath(method),
      body,
      pin: pinOf(endpoint),
      timeoutMs,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof NodePinMismatchError) throw error
    if (options.signal?.aborted) throw error
    const message = controller.signal.aborted ? `timeout after ${timeoutMs}ms` : String(error)
    throw new NodeTransportError(host, message, { cause: error })
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }

  rememberPin(endpoint, reply.fingerprint)

  let parsed: NodeReply
  try {
    parsed = JSON.parse(reply.body) as NodeReply
  } catch {
    throw new NodeTransportError(host, `HTTP ${reply.status}: not JSON`)
  }
  const error = parsed?.error
  if (error && typeof error === 'object') {
    // Очередь ноды переполнена — ответит другая.
    if (String(error.message ?? '').includes('Work queue depth exceeded')) {
      throw new NodeTransportError(host, 'busy', { busy: true })
    }
    throw Object.assign({ ...error }, { httpStatus: reply.status })
  }
  if (reply.status >= 400) {
    // Очередь переполнена — прокси получал это так же, строкой с кодом 500.
    const busy = String(parsed?.error ?? '').includes('Work queue depth exceeded')
    throw new NodeTransportError(host, `HTTP ${reply.status}`, { busy })
  }
  return parsed?.result ?? null
}
