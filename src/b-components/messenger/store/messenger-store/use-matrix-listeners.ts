// Подписки главного стора на события Matrix-клиента: Room.timeline (реакции,
// удаления, новые сообщения → звук/уведомление/read-marker/перезагрузка
// диалогов) и sync (состояние синка, первая загрузка диалогов на PREPARED).
// Вынесено из messenger-store: обработчики зависят только от подсторов и
// двух колбэков, поэтому проверяются на фейковом matrixService без pinia.

import { t } from '@/i18n'
import { notifyMessage } from '@/composables/use-browser-notifications'
import { logger } from '@/services/logger'

import { matrixService } from '../../services/matrix-service'
import glassSound from '../../sounds/glass.mp3'
import {
  getEventType,
  getEventRoomId,
  getEventSender,
  getEventTs,
  isRenderableMessageEvent,
} from '../../helpers'
import { SOUND_MAX_AGE } from '../consts'
import type { MessengerStoreContext } from './types'

const log = logger.scope('[MessengerStore]')

export interface MatrixListenerCallbacks {
  /** Полная (silent) перезагрузка диалогов — на 'PREPARED'. */
  loadDialogs: (silent?: boolean) => Promise<void>
  /** Дебаунсированная перезагрузка — на каждое новое сообщение. */
  scheduleLoadDialogs: () => void
}

/**
 * Регистрирует обработчики Room.timeline и sync. Вызывается один раз перед
 * `matrixService.login` (matrixService копит подписки до создания клиента).
 */
export function registerMatrixListeners(
  ctx: MessengerStoreContext,
  callbacks: MatrixListenerCallbacks
): void {
  const { uiStore, chatStore } = ctx
  const { loadDialogs, scheduleLoadDialogs } = callbacks

  matrixService.on(
    'Room.timeline',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- событие читается и как MatrixEvent (getId), и как сырой JSON (event_id), а room передаётся в приватный MxRoom-тип chat-store; единый строгий тип неприменим
    async (event: any, room: any, toStartOfTimeline: boolean) => {
      if (toStartOfTimeline) return
      const evType = getEventType(event)
      if (evType === 'm.reaction') {
        const roomId = getEventRoomId(event)
        if (uiStore.activeChatId === roomId) {
          const client = matrixService.getClient()
          const list = chatStore.messages[roomId]
          if (client && list)
            chatStore.enrichMessagesWithReactions(room, list, client.getUserId() || '')
        }
        return
      }

      // Redaction (удаление сообщения) — убираем целевое сообщение из ленты.
      if (evType === 'm.room.redaction') {
        const roomId = getEventRoomId(event)
        const redactedId =
          (typeof event.getAssociatedId === 'function' ? event.getAssociatedId() : undefined) ||
          event.event?.redacts ||
          event.redacts ||
          (typeof event.getContent === 'function' ? event.getContent()?.redacts : undefined)
        const list = roomId ? chatStore.messages[roomId] : null
        if (list && typeof redactedId === 'string') {
          const idx = list.findIndex((m) => m.id === redactedId)
          if (idx !== -1) list.splice(idx, 1)
        }
        return
      }

      try {
        if (isRenderableMessageEvent(event)) {
          const roomId = getEventRoomId(event)
          if (chatStore.currentUser.id === 'me') {
            const client = matrixService.getClient()
            if (client) chatStore.currentUser.id = client.getUserId() || 'me'
          }

          const senderId = getEventSender(event)
          const isRecent = Date.now() - getEventTs(event) < SOUND_MAX_AGE
          // «Чат открыт» = виджет виден и это его комната. Свёрнутое окно с
          // выбранным чатом раньше считалось открытым: ни звука, ни бейджа, но
          // серверу уходило «прочитано» (V30).
          const onScreen = uiStore.isChatOnScreen(roomId)
          if (senderId !== chatStore.currentUser.id && !onScreen && isRecent) {
            try {
              new Audio(glassSound).play().catch(() => {})
            } catch {
              /* ignore */
            }
            // Браузерное уведомление о новом сообщении (если вкладка в фоне
            // и пользователь включил браузерные уведомления).
            try {
              const senderName = room.getMember?.(senderId)?.name || senderId
              const body = (event.getContent?.()?.body as string) || ''
              notifyMessage(senderName, body)
            } catch {
              /* ignore */
            }
          }

          if (uiStore.activeChatId === roomId) {
            const msg = await chatStore.mapEventToMessage(event)
            if (!msg) return
            if (!chatStore.messages[roomId]) chatStore.messages[roomId] = []
            if (!chatStore.messages[roomId].find((m) => m.id === msg.id))
              chatStore.messages[roomId].push(msg)
            const c = matrixService.getClient()
            if (c)
              chatStore.enrichMessagesWithReactions(
                room,
                chatStore.messages[roomId],
                c.getUserId() || ''
              )

            try {
              const client = matrixService.getClient()
              const evId = typeof event.getId === 'function' ? event.getId() : event.event_id
              if (onScreen && client && typeof evId === 'string' && evId.startsWith('$')) {
                if (typeof client.setRoomReadMarkers === 'function')
                  await client.setRoomReadMarkers(room.roomId, evId, event)
                else if (typeof client.sendReadReceipt === 'function')
                  await client.sendReadReceipt(event)
              }
            } catch {
              /* ignore */
            }
          }

          scheduleLoadDialogs()
        }
      } catch (e) {
        log.error('Ошибка в Room.timeline:', e)
      }
    }
  )

  matrixService.on('sync', (state: string) => {
    uiStore.syncState = state
    if (state === 'ERROR') {
      uiStore.syncError = t('appMsg.messenger.syncError')
      return
    }
    // Баннер «Ошибка синхронизации» раньше гас только на 'PREPARED', а он
    // бывает раз за жизнь клиента — после восстановления связи (SYNCING)
    // надпись висела навсегда (S38).
    if (state === 'PREPARED' || state === 'SYNCING' || state === 'CATCHUP') {
      uiStore.syncError = null
    }
    if (state === 'PREPARED') {
      loadDialogs(true).then(() => {
        uiStore.dialogsLoadedOnce = true
      })
    }
  })
}
