/**
 * Обработчик FETCH_REQUEST из iframe (SW-туннель):
 * делегирует в `opts.onFetchRequest`, заворачивает ошибки в FETCH_RESPONSE.
 */

import type { InstalledApp } from '../types/app'
import type { FetchRequest } from '../types/messages'
import type { BridgeRouterState } from './bridge-helpers'

export async function handleFetch(
  state: BridgeRouterState,
  app: InstalledApp,
  req: FetchRequest
): Promise<void> {
  if (!state.opts.onFetchRequest) {
    // SW-туннель не сконфигурирован — отвечаем явной ошибкой
    const conn = state.connections.get(app.manifest.id)
    if (conn) {
      state.postRaw(conn, {
        type: 'FETCH_RESPONSE',
        requestId: req.requestId,
        success: false,
        error: 'fetch_tunnel_not_configured',
      })
    }
    return
  }

  try {
    const resp = await state.opts.onFetchRequest(app, req)
    const conn = state.connections.get(app.manifest.id)
    if (conn) state.postRaw(conn, resp)
  } catch (err) {
    const conn = state.connections.get(app.manifest.id)
    if (conn) {
      state.postRaw(conn, {
        type: 'FETCH_RESPONSE',
        requestId: req.requestId,
        success: false,
        error: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }
}
