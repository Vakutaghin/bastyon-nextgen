/**
 * Обработчик RPC-сообщений от iframe: маршрутизирует в `opts.dispatchRpc`,
 * закрывает таймаут через AbortController, отвечает success/error через postRaw.
 */

import { logger } from '@/services/logger'
import { rpcError, rpcSuccess } from '../types/messages'
import type { InstalledApp } from '../types/app'
import { DEFAULT_RPC_TIMEOUT_MS, normalizeError, type BridgeRouterState } from './bridge-helpers'

const log = logger.scope('[mini-apps:bridge]')

export async function handleRpc(
  state: BridgeRouterState,
  app: InstalledApp,
  requestId: string,
  action: string,
  data: unknown
): Promise<void> {
  // Ключ с appId: requestId выбирает сама миниаппа, и без префикса два
  // приложения с одинаковым id запроса делили бы один AbortController (N23).
  const inflightKey = `${app.manifest.id}:${requestId}`
  const ctrl = new AbortController()
  state.inflight.set(inflightKey, ctrl)

  const timeoutMs = state.opts.rpcTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS
  const timer = setTimeout(() => {
    ctrl.abort(new Error('rpc_timeout'))
  }, timeoutMs)

  const start = performance.now()
  try {
    const result = await state.opts.dispatchRpc({
      app,
      action,
      data,
      signal: ctrl.signal,
    })
    const conn = state.connections.get(app.manifest.id)
    if (conn) state.postRaw(conn, rpcSuccess(requestId, result))
    log.debug('rpc ok', app.manifest.id, action, `${(performance.now() - start).toFixed(1)}ms`)
  } catch (err) {
    const conn = state.connections.get(app.manifest.id)
    if (conn) state.postRaw(conn, rpcError(requestId, normalizeError(err, ctrl.signal)))
    log.debug('rpc err', app.manifest.id, action, err)
  } finally {
    clearTimeout(timer)
    state.inflight.delete(inflightKey)
  }
}
