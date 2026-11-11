/**
 * Сообщения в поиске над списком чатов, как в Telegram: найденное во всех
 * чатах — от новых к старым, с чатом, автором и словами в контексте.
 *
 * Переписка зашифрована, и сервер искать в ней не может, поэтому ищем то, что
 * есть на устройстве: ленты открытых чатов, ленты комнат из синка (последние
 * сообщения каждого чата) и копию переписки на устройстве, если она
 * включена. Ленты комнат и копия читаются в фоне один раз за открытие
 * поиска, свежие чаты первыми; найденное появляется по мере чтения. Всю
 * историю одного чата с сервера листает поиск внутри него (chat-room).
 */

import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { yieldToMain } from '@/helpers/common/yield-to-main'
import type { Dialog, Message } from '../../types'
import { messageMatches, searchTokens } from '../../lib/message-search'

/** Пауза в наборе, после которой ищем. */
export const MESSAGE_SEARCH_DEBOUNCE_MS = 250
/** Сколько найденного показывать сразу и сколько добавлять по «Показать ещё». */
export const MESSAGE_PAGE = 20

export interface MessageHit {
  chatId: string
  message: Message
}

export interface MessageSearchDeps {
  query: Ref<string>
  /** Поиск открыт: пока нет — ничего не читаем. */
  open: () => boolean
  /** Чаты, в которых искать: свежие первыми. */
  chats: () => readonly Dialog[]
  /** Лента чата, уже разобранная в памяти. */
  loaded: (chatId: string) => readonly Message[] | undefined
  /** Лента комнаты, что уже есть на устройстве (синк). */
  recent: (chatId: string) => Promise<Message[]>
  /** Копия переписки на устройстве. */
  archived: (chatId: string) => Promise<Message[]>
}

export function useMessageSearch(deps: MessageSearchDeps) {
  const tokens = ref<string[]>([])
  const limit = ref(MESSAGE_PAGE)
  /** Прочитанное в фоне: ленты комнат и копия, по чатам. */
  const pool = shallowRef(new Map<string, Message[]>())
  const reading = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  function flush(): void {
    if (timer) clearTimeout(timer)
    timer = null
    const next = searchTokens(deps.query.value)
    if (next.join(' ') !== tokens.value.join(' ')) tokens.value = next
  }
  watch(deps.query, (q) => {
    if (timer) clearTimeout(timer)
    // Стёрли — сразу, без паузы.
    if (!q.trim()) return flush()
    timer = setTimeout(flush, MESSAGE_SEARCH_DEBOUNCE_MS)
  })
  watch(tokens, () => (limit.value = MESSAGE_PAGE))

  const active = computed(() => deps.open() && tokens.value.length > 0)

  let run = 0
  let disposed = false
  /** Прочитать ленты комнат и копию всех чатов; уже прочитанное сторы отдают из памяти. */
  async function read(): Promise<void> {
    const mine = ++run
    reading.value = true
    try {
      for (const chat of deps.chats()) {
        if (mine !== run || disposed) return
        const [recent, archived] = await Promise.all([
          deps.recent(chat.id).catch(() => []),
          deps.archived(chat.id).catch(() => []),
        ])
        if (mine !== run || disposed) return
        const next = new Map(pool.value)
        next.set(chat.id, archived.length ? [...recent, ...archived] : recent)
        pool.value = next
        await yieldToMain()
      }
    } finally {
      if (mine === run) reading.value = false
    }
  }

  // Начали искать — читаем всё, что есть на устройстве. Закрыли поиск —
  // перестаём; открыли снова — перечитываем: пришло новое, сторы помнят старое.
  watch(active, (on) => {
    if (on && !reading.value) void read()
  })
  watch(
    () => deps.open(),
    (open) => {
      if (open) return
      run++
      reading.value = false
      pool.value = new Map()
    }
  )

  onScopeDispose(() => {
    disposed = true
    if (timer) clearTimeout(timer)
  })

  /** Всё найденное, от новых к старым; в каждом чате без повторов. */
  const hits = computed<MessageHit[]>(() => {
    if (!active.value) return []
    const words = tokens.value
    const out: MessageHit[] = []
    for (const chat of deps.chats()) {
      const seen = new Set<string>()
      const sources: (readonly Message[] | undefined)[] = [
        deps.loaded(chat.id),
        pool.value.get(chat.id),
        chat.lastMessage ? [chat.lastMessage] : undefined,
      ]
      for (const list of sources) {
        for (const m of list ?? []) {
          if (seen.has(m.id) || !messageMatches(m, words)) continue
          seen.add(m.id)
          out.push({ chatId: chat.id, message: m })
        }
      }
    }
    return out.sort((a, b) => b.message.timestamp - a.message.timestamp)
  })

  const shown = computed<MessageHit[]>(() => hits.value.slice(0, limit.value))
  const hasMore = computed<boolean>(() => hits.value.length > limit.value)

  function more(): void {
    limit.value += MESSAGE_PAGE
  }

  return { tokens, active, hits, shown, hasMore, reading, more, flush }
}
