// Отметка «прочитано» на сервере: по ней сервер перестаёт считать чат
// непрочитанным, а собеседник видит «✓✓».
//
// Отметка уходила один раз, пока чат на экране. Не дошла (моргнула сеть, Tor,
// сокет умер при смене сети) — её никто не повторял: чат закрыли, сервер
// считал его непрочитанным, и число возвращалось, а после перезапуска
// приложения стояло снова. Теперь недошедшая повторяется, пока не дойдёт.

import type { MatrixEvent } from 'matrix-js-sdk'

import { isMeshDialogId } from '@/mesh/ids'
import { logger } from '@/services/logger'

import { isChannelChatId } from '../../lib/channels'
import { within } from '../../lib/within'
import { matrixService } from '../../services/matrix-service'
import { READ_MARKER_TIMEOUT } from '../consts'
import type { MessengerStoreContext } from './types'

const log = logger.scope('[MessengerStore]')

/** Сервер отказал насовсем (вышли из чата, комнаты нет) — повторять нечего. */
function isRefused(error: unknown): boolean {
  const status = (error as { httpStatus?: unknown } | null)?.httpStatus
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 429
}

export function useReadMarkers({ uiStore }: Pick<MessengerStoreContext, 'uiStore'>) {
  /** До какого события чат отмечен прочитанным (отправлено или отправляется), по комнатам. */
  const sent = new Map<string, string>()
  /** Не дошло до сервера: повторить, даже если чат уже закрыли, — его прочитали. */
  const unsent = new Map<string, MatrixEvent>()
  /** Растёт на выходе: отметки прежнего аккаунта после него не повторяются. */
  let session = 0

  const send = async (roomId: string, event: MatrixEvent): Promise<void> => {
    const run = session
    const eventId = event.getId()!
    sent.set(roomId, eventId)
    unsent.delete(roomId)
    let ok = false
    let refused = false
    try {
      const client = matrixService.getClient()
      const request: Promise<unknown> | undefined = client?.setRoomReadMarkers
        ? client.setRoomReadMarkers(roomId, eventId, event)
        : client?.sendReadReceipt(event)
      ok = !!request && (await within(Promise.resolve(request), READ_MARKER_TIMEOUT)).done
    } catch (e) {
      log.debug('read marker not sent', e)
      refused = isRefused(e)
    }
    // Пока отправляли, отметили дальше или вышли — эта уже не нужна.
    if (ok || run !== session || sent.get(roomId) !== eventId) return
    sent.delete(roomId)
    if (!refused) unsent.set(roomId, event)
  }

  /**
   * Сказать серверу, что чат прочитан до последнего события. Только если чат
   * на экране (V30) и раз на событие.
   */
  const markRoomRead = async (roomId: string): Promise<void> => {
    if (isMeshDialogId(roomId) || isChannelChatId(roomId) || !uiStore.isChatOnScreen(roomId)) {
      return
    }
    const room = matrixService.getRoom(roomId)
    if (!room) return
    const last = [...room.getLiveTimeline().getEvents()]
      .reverse()
      .find((e: MatrixEvent) => e.getId()?.startsWith('$')) as MatrixEvent | undefined
    if (!last || sent.get(roomId) === last.getId()) return
    await send(roomId, last)
  }

  /** Связь есть: повторить недошедшее. */
  const flush = (): void => {
    for (const [roomId, event] of [...unsent]) void send(roomId, event)
  }

  const reset = (): void => {
    session++
    sent.clear()
    unsent.clear()
  }

  return { markRoomRead, flush, reset }
}

export type ReadMarkers = ReturnType<typeof useReadMarkers>
