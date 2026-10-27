// Загрузка и пагинация истории сообщений комнаты. Маппинг и обогащение
// реакциями делегируются use-message-mapping; ожидание pcrypto — use-chat-crypto.

import { reactive, ref } from 'vue'

import { matrixService } from '../../services/matrix-service'
import { getRoomTimelineEvents, isMessageEvent } from '../../helpers'
import {
  reachedHistoryStart,
  readHistory,
  type ChatHistory,
  type HistoryRoom,
} from '../../lib/chat-history'
import type { Message } from '../../types'
import { MESSAGES_PER_PAGE, ROOM_WAIT_TIMEOUT } from '../consts'
import type { ChatContext, MxRoom } from './types'
import type { ChatCrypto } from './use-chat-crypto'
import type { MessageMapping } from './use-message-mapping'

/** Сколько сообщений нужно на экране сразу, и сколько страниц листать ради них. */
const MIN_SHOWN_MESSAGES = 10
const MAX_HISTORY_PAGES = 5

export function useMessageLoading(
  ctx: ChatContext,
  chatCrypto: ChatCrypto,
  mapping: MessageMapping
) {
  const { messages, uiStore } = ctx
  const { ensurePcryptoInitialized, pcryptoService, waitForPcrypto } = chatCrypto
  const { mapEventToMessage, enrichMessagesWithReactions } = mapping

  const isLoadingMore = ref(false)
  /** Что известно об истории чатов: начало, создатель, чистка сервером, ошибка. */
  const history = reactive<Record<string, ChatHistory>>({})

  const noteHistory = (chatId: string, room: MxRoom | null, error?: unknown) => {
    const myUserId = matrixService.getClient()?.getUserId() || ''
    const state: ChatHistory = room
      ? readHistory(room as unknown as HistoryRoom, myUserId)
      : { reachedStart: false }
    if (error !== undefined) {
      state.error = error instanceof Error ? error.message : String(error || 'unknown')
    }
    history[chatId] = state
  }
  /**
   * Флаг загрузки общий на все чаты: гасит его только последний вызов. Иначе
   * чат, который ещё ждал комнату, снимал загрузку у чата, открытого после него.
   */
  let loadSeq = 0

  /**
   * Листаем назад, пока на экране не наберётся сообщений или не кончится
   * история. Раньше — одну страницу: если в конце ленты были только служебные
   * события (вступления, роли, реакции), чат открывался пустым.
   */
  const paginateRoomHistory = async (room: MxRoom) => {
    const client = matrixService.getClient()
    if (!client || !room || typeof room.getLiveTimeline !== 'function') return
    const liveTimeline = room.getLiveTimeline()
    for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
      const events = liveTimeline.getEvents()
      const messageCount = events.filter(isMessageEvent).length
      if (events.length >= MESSAGES_PER_PAGE && messageCount >= MIN_SHOWN_MESSAGES) return
      if (reachedHistoryStart(room as unknown as HistoryRoom)) return
      const more = await client.paginateEventTimeline(liveTimeline, {
        backwards: true,
        limit: MESSAGES_PER_PAGE,
      })
      if (!more) return
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
        // Копию своего события (`~`-id) без статуса отправки не сохраняем: она уже
        // есть в истории под настоящим id, и раньше чат показывал её второй раз —
        // часто как «*** Encrypted Message ***». Эхо, которое ещё отправляется
        // или не ушло, остаётся.
        const arrivedWhileLoading = messages[chatId] ?? []
        const knownIds = new Set(list.map((m) => m.id))
        const extra = arrivedWhileLoading.filter(
          (m) => !knownIds.has(m.id) && !(m.id.startsWith('~') && m.status === 'sent')
        )
        if (extra.length > 0) {
          list.push(...extra)
          list.sort((a, b) => a.timestamp - b.timestamp)
        }
        messages[chatId] = list
        const client = matrixService.getClient()
        if (client) enrichMessagesWithReactions(room, list, client.getUserId() || '')
        noteHistory(chatId, room)
      } else if (uiStore.activeChatId === chatId) {
        // Синк прошёл, а комнаты нет: сервер её не знает или нас в ней нет.
        noteHistory(chatId, null, 'room_not_found')
      }
    } catch (e) {
      console.error('[ChatStore] Ошибка загрузки сообщений:', e)
      // Раньше чат просто оставался пустым — теперь видно, что история не загрузилась.
      noteHistory(chatId, matrixService.getRoom(chatId), e)
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
      noteHistory(chatId, room)
    } catch (e) {
      console.error('[ChatStore] Ошибка подгрузки истории:', e)
      noteHistory(chatId, room, e)
    } finally {
      isLoadingMore.value = false
    }
  }

  return { history, loadMessages, loadMoreMessages }
}

export type MessageLoading = ReturnType<typeof useMessageLoading>
