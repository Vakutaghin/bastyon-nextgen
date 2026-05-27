/**
 * Обработчик `{id, listener}` сообщений: iframe регистрирует push-канал
 * для получения событий из хоста.
 */

import { logger } from '@/services/logger'
import { rpcSuccess } from '../types/messages'
import type { InstalledApp } from '../types/app'
import type { BridgeRouterState } from './bridge-helpers'

const log = logger.scope('[mini-apps:bridge]')

export function handleListener(
  state: BridgeRouterState,
  app: InstalledApp,
  requestId: string,
  listenerId: string
): void {
  const conn = state.connections.get(app.manifest.id)
  if (!conn) return
  conn.listenerId = listenerId
  state.postRaw(conn, rpcSuccess(requestId, 'registered'))
  state.opts.onListenerRegistered?.(app, listenerId)
  log.debug('listener registered', app.manifest.id, listenerId)
}
