// Загрузка и пагинация истории сообщений комнаты. Маппинг и обогащение
// реакциями делегируются use-message-mapping; ожидание pcrypto — use-chat-crypto.

import { ref } from 'vue'

import { matrixService } from '../../services/matrix-service'
import { getRoomTimelineEvents } from '../../helpers'
import type { Message } from '../../types'
import { MESSAGES_PER_PAGE } from '../consts'
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

  const loadMessages = async (chatId: string) => {
    uiStore.activeChatId = chatId
    uiStore.isMessagesLoading = true
    try {
      ensurePcryptoInitialized()
      if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()

      const room = matrixService.getRoom(chatId)
      if (room) {
        // Если по комнате висит приглашение — вступаем при открытии. Иначе
        // последующая отправка падает с M_FORBIDDEN («not in room»), а состояние
        // комнаты (участники/история) подгружается не полностью.
        await matrixService.joinIfInvited(chatId)
        await room.loadMembersIfNeeded()
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
      uiStore.isMessagesLoading = false
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
