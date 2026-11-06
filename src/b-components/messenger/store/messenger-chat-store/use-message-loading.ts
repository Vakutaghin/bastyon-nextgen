// Загрузка и пагинация истории сообщений комнаты. Маппинг и обогащение
// реакциями делегируются use-message-mapping; ожидание pcrypto — use-chat-crypto.

import { reactive, ref } from 'vue'

import { yieldToMain } from '@/helpers/common/yield-to-main'
import { matrixService } from '../../services/matrix-service'
import { getRoomTimelineEvents, isMessageEvent } from '../../helpers'
import { earliestServerTs, isNotFoundError } from '../../lib/archive-merge'
import { within } from '../../lib/within'
import {
  reachedHistoryStart,
  readHistory,
  type ChatHistory,
  type HistoryRoom,
} from '../../lib/chat-history'
import type { Message } from '../../types'
import {
  HISTORY_STEP_TIMEOUT,
  KNOWN_DECRYPT_TIMEOUT,
  MESSAGES_PER_PAGE,
  OPEN_DECRYPT_TIMEOUT,
  ROOM_WAIT_TIMEOUT,
} from '../consts'
import type { ChatContext, MxEvent, MxRoom } from './types'
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
  const { messages, uiStore, archive } = ctx
  const { ensurePcryptoInitialized, pcryptoService, waitForPcrypto } = chatCrypto
  const { mapEventToMessage, enrichMessagesWithReactions } = mapping

  const isLoadingMore = ref(false)
  /** Что известно об истории чатов: начало, создатель, чистка сервером, ошибка. */
  const history = reactive<Record<string, ChatHistory>>({})

  const noteHistory = (
    chatId: string,
    room: MxRoom | null,
    error?: unknown,
    archiveMore?: boolean
  ) => {
    const myUserId = matrixService.getClient()?.getUserId() || ''
    const state: ChatHistory = room
      ? readHistory(room as unknown as HistoryRoom, myUserId)
      : { reachedStart: false }
    if (error !== undefined) {
      state.error = error instanceof Error ? error.message : String(error || 'unknown')
    }
    if (archiveMore) state.archiveMore = true
    history[chatId] = state
  }

  /** Чаты, где уже спрашивали сервер, что из сохранённого он стёр (раз за запуск). */
  const probed = new Set<string>()

  /**
   * Сервер больше не листает, а начала ленты не видно — что из показанного
   * сохранённого он стёр, узнаём точечно (lib/archive-merge, findGoneBoundary).
   */
  const markGone = async (chatId: string, server: Message[]) => {
    if (probed.has(chatId) || !archive.hasCopy(chatId)) return
    probed.add(chatId)
    const client = matrixService.getClient()
    if (!client?.fetchRoomEvent) return
    const moved = await archive.probeGone(chatId, earliestServerTs(server), async (id) => {
      try {
        const event = await client.fetchRoomEvent(chatId, id)
        // Удалили, пока копия не знала, — стираем и здесь.
        if (event?.unsigned?.redacted_because) void archive.remove(chatId, [id])
        return false
      } catch (e) {
        return isNotFoundError(e) ? true : null
      }
    })
    if (!moved) return
    const gone = archive.goneBefore[chatId] ?? 0
    for (const m of messages[chatId] ?? [])
      if (m.archived && m.timestamp <= gone) m.localOnly = true
  }

  /** То, что ещё не дошло до сервера (отправляется, не ушло), при пересборке ленты не теряем. */
  const keepPending = (list: Message[], current: Message[] | undefined): Message[] => {
    const ids = new Set(list.map((m) => m.id))
    const pending = (current ?? []).filter(
      (m) => !m.archived && !ids.has(m.id) && !m.id.startsWith('$') && m.status !== 'sent'
    )
    return pending.length ? [...list, ...pending] : list
  }
  /**
   * Флаг загрузки общий на все чаты: гасит его только последний вызов. Иначе
   * чат, который ещё ждал комнату, снимал загрузку у чата, открытого после него.
   */
  let loadSeq = 0
  /** Чаты, которые сейчас открываются (→ номер загрузки): подгрузка выше ждёт, пока лента соберётся. */
  const opening = new Map<string, number>()

  /**
   * События ленты комнаты без local-echo matrix-js-sdk (id вида `~…`): они
   * попадают в IndexedDB-стор и возвращаются при следующем запуске, сообщение
   * висит навсегда без ответа/удаления — действия требуют `$`-id. Своё только
   * что отправленное показывает наш оптимистичный слой, терять нечего (N19).
   */
  const timelineOf = (room: MxRoom): MxEvent[] =>
    getRoomTimelineEvents(room).filter((e) => {
      const id = typeof e?.getId === 'function' ? e.getId() : e?.event_id
      return typeof id !== 'string' || !id.startsWith('~')
    })

  /**
   * Пока сервер листает историю, показываем то, что уже есть на устройстве:
   * ленту комнаты из синка. Раньше до конца загрузки чат был закрыт
   * заставкой, и отправленное в это время пропадало из виду. Только если всё
   * расшифровалось быстро (из кэша): лента из заглушек хуже загрузки. Идёт
   * рядом с запросами к серверу и не трогает ленту, которая уже с сервера.
   */
  const showKnown = async (chatId: string, room: MxRoom, seq: number) => {
    const fromServer = () => !!messages[chatId]?.some((m) => m.id.startsWith('$'))
    if (fromServer()) return
    const events = timelineOf(room)
    if (!events.length) return
    const quick = await within(
      Promise.all(events.map((e) => mapEventToMessage(e))),
      KNOWN_DECRYPT_TIMEOUT
    )
    if (!quick.done || seq !== loadSeq || uiStore.activeChatId !== chatId) return
    if (opening.get(chatId) !== seq || fromServer()) return
    const list = keepPending(
      quick.value.filter((m): m is Message => Boolean(m)),
      messages[chatId]
    )
    const client = matrixService.getClient()
    if (client) enrichMessagesWithReactions(room, list, client.getUserId() || '')
    messages[chatId] = list
  }

  /**
   * Листаем назад, пока на экране не наберётся сообщений или не кончится
   * история. Раньше — одну страницу: если в конце ленты были только служебные
   * события (вступления, роли, реакции), чат открывался пустым.
   */
  /**
   * `exhausted` — сервер старше ничего не отдаст: дошли до начала или он
   * перестал листать; `slow` — страница не пришла за HISTORY_STEP_TIMEOUT,
   * показываем то, что уже есть.
   */
  const paginateRoomHistory = async (
    room: MxRoom
  ): Promise<{ exhausted: boolean; slow: boolean }> => {
    const client = matrixService.getClient()
    if (!client || !room || typeof room.getLiveTimeline !== 'function')
      return { exhausted: false, slow: false }
    const liveTimeline = room.getLiveTimeline()
    for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
      const events = liveTimeline.getEvents()
      const messageCount = events.filter(isMessageEvent).length
      if (events.length >= MESSAGES_PER_PAGE && messageCount >= MIN_SHOWN_MESSAGES)
        return { exhausted: false, slow: false }
      if (reachedHistoryStart(room as unknown as HistoryRoom))
        return { exhausted: true, slow: false }
      const more = await within(
        client.paginateEventTimeline(liveTimeline, {
          backwards: true,
          limit: MESSAGES_PER_PAGE,
        }),
        HISTORY_STEP_TIMEOUT
      )
      if (!more.done) return { exhausted: false, slow: true }
      if (!more.value) return { exhausted: true, slow: false }
    }
    return { exhausted: false, slow: false }
  }

  /**
   * Сообщение для ленты при открытии: расшифровка, ждущая ключи дольше
   * OPEN_DECRYPT_TIMEOUT, не держит весь чат — пока заглушка, повтор
   * расшифрует (use-redecrypt).
   */
  const mapForOpen = async (event: MxEvent): Promise<Message | null> => {
    const mapped = await within(mapEventToMessage(event), OPEN_DECRYPT_TIMEOUT)
    return mapped.done ? mapped.value : mapEventToMessage(event, true)
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
    opening.set(chatId, seq)
    try {
      const room = await waitForRoom(chatId)
      ensurePcryptoInitialized()
      if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()

      if (room?.getMyMembership?.() === 'invite') {
        // Приглашение принимают или отклоняют в окне чата (chat-invite): молча
        // вступать в чужой чат нельзя, а до вступления ленты у комнаты нет.
        messages[chatId] = []
        noteHistory(chatId, room)
      } else if (room) {
        void showKnown(chatId, room, seq)
        // Каждый запрос — не дольше HISTORY_STEP_TIMEOUT: сокет, умерший при
        // смене сети, держал «Загрузка сообщений…» бесконечно.
        const members = await within(
          Promise.resolve(room.loadMembersIfNeeded?.()),
          HISTORY_STEP_TIMEOUT
        )
        const { exhausted, slow } = await paginateRoomHistory(room)
        const incomplete = !members.done || slow
        const mapped = await Promise.all(timelineOf(room).map((e) => mapForOpen(e)))
        const list = mapped.filter((m): m is Message => Boolean(m))
        // Расшифровки дочитываются цепочкой микрозадач, и отрисовка ленты шла
        // с ними одной длинной задачей: между ними — передышка вводу.
        await yieldToMain()

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
        const client = matrixService.getClient()
        if (client) enrichMessagesWithReactions(room, list, client.getUserId() || '')
        // Что сервер уже стёр, а на устройстве сохранено, — над его лентой.
        const reachedStart = reachedHistoryStart(room as unknown as HistoryRoom)
        const merged = await archive.mergeInto(chatId, list, { exhausted, reachedStart })
        messages[chatId] = merged.messages
        void archive.save(chatId, list)
        noteHistory(chatId, room, incomplete ? 'timeout' : undefined, merged.more)
        if (merged.messages.length > list.length && !reachedStart) void markGone(chatId, list)
      } else if (uiStore.activeChatId === chatId) {
        // Синк прошёл, а комнаты нет: сервер её не знает или нас в ней нет.
        noteHistory(chatId, null, 'room_not_found')
      }
    } catch (e) {
      console.error('[ChatStore] Ошибка загрузки сообщений:', e)
      // Раньше чат просто оставался пустым — теперь видно, что история не загрузилась.
      noteHistory(chatId, matrixService.getRoom(chatId), e)
    } finally {
      if (opening.get(chatId) === seq) opening.delete(chatId)
      if (seq === loadSeq) uiStore.isMessagesLoading = false
    }
  }

  const loadMoreMessages = async (chatId: string) => {
    // Открытие чата само листает историю и пересобирает ленту целиком.
    if (!chatId || isLoadingMore.value || opening.has(chatId)) return
    const room = matrixService.getRoom(chatId)
    if (!room) return

    isLoadingMore.value = true
    try {
      const client = matrixService.getClient()
      const liveTimeline = room.getLiveTimeline()
      const initialCount = liveTimeline.getEvents().length
      const historyRoom = room as unknown as HistoryRoom

      // Сервер дошёл до начала или перестал листать — дальше только сохранённое на устройстве.
      let exhausted = reachedHistoryStart(historyRoom)
      if (!exhausted) {
        const more = await client.paginateEventTimeline(liveTimeline, {
          backwards: true,
          limit: MESSAGES_PER_PAGE,
        })
        exhausted = !more || reachedHistoryStart(historyRoom)
      }
      const finalCount = liveTimeline.getEvents().length
      const added = finalCount > initialCount
      let archiveMore = false

      if (added || (exhausted && history[chatId]?.archiveMore)) {
        const mapped = await Promise.all(timelineOf(room).map((e) => mapEventToMessage(e)))
        const list = keepPending(
          mapped.filter((m): m is Message => Boolean(m)),
          messages[chatId]
        )
        if (client) enrichMessagesWithReactions(room, list, client.getUserId() || '')
        const reachedStart = reachedHistoryStart(historyRoom)
        const merged = await archive.mergeInto(chatId, list, {
          exhausted,
          reachedStart,
          older: !added,
        })
        messages[chatId] = merged.messages
        archiveMore = merged.more
        void archive.save(chatId, list)
        if (merged.messages.length > list.length && !reachedStart) void markGone(chatId, list)
      } else {
        archiveMore = !!history[chatId]?.archiveMore
      }
      noteHistory(chatId, room, undefined, archiveMore)
    } catch (e) {
      console.error('[ChatStore] Ошибка подгрузки истории:', e)
      noteHistory(chatId, room, e)
    } finally {
      isLoadingMore.value = false
    }
  }

  return { history, isLoadingMore, loadMessages, loadMoreMessages }
}

export type MessageLoading = ReturnType<typeof useMessageLoading>
