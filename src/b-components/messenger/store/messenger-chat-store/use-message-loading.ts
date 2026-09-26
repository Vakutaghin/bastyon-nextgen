// Загрузка и пагинация истории сообщений комнаты. Маппинг и обогащение
// реакциями делегируются use-message-mapping; ожидание pcrypto — use-chat-crypto.

import { ref } from 'vue'

import { matrixService } from '../../services/matrix-service'
import { getRoomTimelineEvents } from '../../helpers'
import type { Message } from '../../types'
import { MESSAGES_PER_PAGE, ROOM_WAIT_TIMEOUT } from '../consts'
import type { ChatContext, MxRoom } from './types'
import type { ChatCrypto } from './use-chat-crypto'
import type { MessageMapping } from './use-message-mapping'

export function useMessageLoading(
  ctx: ChatContext,
  chatCrypto: ChatCrypto,
  mapping: MessageMapping
) {
  const { messages, uiStore } = ctx
  const { ensurePcryptoInitialized, pcryptoService, waitForPcrypto } = chatCrypto
  const { mapEventToMessage, enrichMessagesWithReactions } = mapping

  const isLoadingMore = ref(false)
  /**
   * Флаг загрузки общий на все чаты: гасит его только последний вызов. Иначе
   * чат, который ещё ждал комнату, снимал загрузку у чата, открытого после него.
   */
  let loadSeq = 0

  const paginateRoomHistory = async (room: MxRoom) => {
    const client = matrixService.getClient()
    if (!client || !room || typeof room.getLiveTimeline !== 'function') return
    const liveTimeline = room.getLiveTimeline()
    if (liveTimeline.getEvents().length < MESSAGES_PER_PAGE) {
      await client.paginateEventTimeline(liveTimeline, {
        backwards: true,
        limit: MESSAGES_PER_PAGE,
      })
    }
  }

  /**
   * Комната чата. Список диалогов после запуска показывается с прошлого раза
   * ещё до входа в Matrix, и чат можно открыть раньше, чем клиент узнает о
   * комнатах: ждём первого синка, пока пользователь не ушёл из этого чата.
   */
  const waitForRoom = async (chatId: string): Promise<MxRoom | null> => {
    const deadline = Date.now() + ROOM_WAIT_TIMEOUT
    for (;;) {
      const room = matrixService.getRoom(chatId)
      if (room) return room
      const synced =
        !!matrixService.getClient() &&
        (uiStore.syncState === 'PREPARED' || uiStore.syncState === 'SYNCING')
      if (synced || uiStore.activeChatId !== chatId || Date.now() > deadline) return null
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  const loadMessages = async (chatId: string) => {
    const seq = ++loadSeq
    uiStore.activeChatId = chatId
    uiStore.isMessagesLoading = true
    try {
      const room = await waitForRoom(chatId)
      ensurePcryptoInitialized()
      if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()

      if (room) {
        // Если по комнате висит приглашение — вступаем при открытии. Иначе
        // последующая отправка падает с M_FORBIDDEN («not in room»), а состояние
        // комнаты (участники/история) подгружается не полностью.
        await matrixService.joinIfInvited(chatId)
        await room.loadMembersIfNeeded?.()
        await paginateRoomHistory(room)
        // Local-echo события matrix-js-sdk (id вида `~…`) попадают в
        // IndexedDB-стор и возвращаются при следующем запуске: сообщение висит
        // навсегда без ответа/удаления, потому что действия требуют `$`-id.
        // Своё только что отправленное сообщение показывает наш собственный
        // оптимистичный слой, так что терять нечего (N19).
        const timelineEvents = getRoomTimelineEvents(room).filter((e) => {
          const id = typeof e?.getId === 'function' ? e.getId() : e?.event_id
          return typeof id !== 'string' || !id.startsWith('~')
        })
        const mapped = await Promise.all(timelineEvents.map((e) => mapEventToMessage(e)))
        const list = mapped.filter((m): m is Message => Boolean(m))

        // Пока грузилась история, по WS могло прийти новое сообщение (и на него
        // уже ушёл read-receipt). Голое присваивание снимка затирало его —
        // сообщение пропадало из ленты до перезахода в чат (S36). Поэтому
        // снимок сливаем с тем, что успело появиться, по id.
        const arrivedWhileLoading = messages[chatId] ?? []
        const knownIds = new Set(list.map((m) => m.id))
        const extra = arrivedWhileLoading.filter((m) => !knownIds.has(m.id))
        if (extra.length > 0) {
          list.push(...extra)
          list.sort((a, b) => a.timestamp - b.timestamp)
        }
        messages[chatId] = list
        const client = matrixService.getClient()
        if (client) enrichMessagesWithReactions(room, list, client.getUserId() || '')
      }
    } catch (e) {
      console.error('[ChatStore] Ошибка загрузки сообщений:', e)
    } finally {
      if (seq === loadSeq) uiStore.isMessagesLoading = false
    }
  }

  const loadMoreMessages = async (chatId: string) => {
    if (!chatId || isLoadingMore.value) return
    const room = matrixService.getRoom(chatId)
    if (!room) return

    isLoadingMore.value = true
    try {
      const client = matrixService.getClient()
      const liveTimeline = room.getLiveTimeline()
      const initialCount = liveTimeline.getEvents().length

      await client.paginateEventTimeline(liveTimeline, {
        backwards: true,
        limit: MESSAGES_PER_PAGE,
      })
      const finalCount = liveTimeline.getEvents().length

      if (finalCount > initialCount) {
        const timelineEvents = getRoomTimelineEvents(room)
        const mapped = await Promise.all(timelineEvents.map((e) => mapEventToMessage(e)))
        const list = mapped.filter((m): m is Message => Boolean(m))
        messages[chatId] = list
        if (client) enrichMessagesWithReactions(room, list, client.getUserId() || '')
      }
    } catch (e) {
      console.error('[ChatStore] Ошибка подгрузки истории:', e)
    } finally {
      isLoadingMore.value = false
    }
  }

  return { loadMessages, loadMoreMessages }
}

export type MessageLoading = ReturnType<typeof useMessageLoading>
