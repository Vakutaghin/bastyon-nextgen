/**
 * Поиск по переписке, как в Telegram: лента остаётся на месте, найденные
 * сообщения перебираются стрелками — от новых к старым. Первое найденное
 * (самое свежее) открывается сразу; Enter — следующее, старше, Shift+Enter —
 * обратно. Слова подсвечиваются в ленте (message-list/use-search-highlight).
 *
 * Найденное — из загруженной ленты и из `extra`: того, что поиск нашёл в
 * истории глубже неё (use-history-search). Переход к такому сообщению
 * сначала догружает ленту до него (`load`).
 *
 * Из поиска по всем чатам чат открывается сразу на выбранном сообщении
 * (`openAt`), с тем же запросом.
 */

import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { Message } from '../../types'
import { messageMatches, searchTokens } from '../../lib/message-search'

/** Пауза в наборе, после которой ищем. */
export const SEARCH_DEBOUNCE_MS = 200

export interface RoomSearchOptions {
  /** Загруженная лента чата, от старых к новым. */
  messages: () => readonly Message[]
  /** Найденное глубже загруженной ленты (любой порядок). */
  extra?: () => readonly Message[]
  /** Прокрутить ленту к сообщению; false — его в ленте нет. */
  reveal: (id: string) => Promise<boolean>
  /** Догрузить ленту до сообщения; false — не вышло. */
  load?: (message: Message) => Promise<boolean>
}

export function useRoomSearch(opts: RoomSearchOptions) {
  const query = ref('')
  const tokens = ref<string[]>([])
  const index = ref(0)
  /** Идёт переход к сообщению, которого ещё нет в ленте. */
  const opening = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  function flush(): void {
    if (timer) clearTimeout(timer)
    timer = null
    const next = searchTokens(query.value)
    if (next.join(' ') !== tokens.value.join(' ')) tokens.value = next
  }
  watch(query, () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, SEARCH_DEBOUNCE_MS)
  })
  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })

  const active = computed(() => tokens.value.length > 0)

  /**
   * Сообщение, выбранное в поиске по всем чатам (openAt): в найденном с
   * самого начала, даже если его ещё нет ни в ленте, ни в прочитанной истории.
   */
  const pinned = shallowRef<Message | null>(null)
  /** На каком сообщении встать при следующем новом запросе вместо самого свежего. */
  let startAt: string | null = null

  /** Найденное, от новых к старым, без повторов: из ленты — её экземпляр. */
  const hits = computed<Message[]>(() => {
    if (!active.value) return []
    const words = tokens.value
    const seen = new Set<string>()
    const out: Message[] = []
    const sources = [...opts.messages(), ...(opts.extra?.() ?? [])]
    if (pinned.value) sources.push(pinned.value)
    for (const m of sources) {
      if (seen.has(m.id) || !messageMatches(m, words)) continue
      seen.add(m.id)
      out.push(m)
    }
    return out.sort((a, b) => b.timestamp - a.timestamp)
  })

  const current = computed<Message | null>(() => hits.value[index.value] ?? null)
  const currentId = computed<string | null>(() => current.value?.id ?? null)

  let goSeq = 0
  async function go(): Promise<void> {
    const target = current.value
    if (!target) return
    const mine = ++goSeq
    if (await opts.reveal(target.id)) return
    if (!opts.load || mine !== goSeq) return
    opening.value = true
    try {
      const loaded = await opts.load(target)
      if (loaded && mine === goSeq) await opts.reveal(target.id)
    } finally {
      if (mine === goSeq) opening.value = false
    }
  }

  // Новый запрос — с самого свежего найденного. Тот же запрос, а нашлось ещё
  // (подгрузили историю, пришло новое) — стоим на том же сообщении.
  watch([tokens, hits], ([words, list], [wordsBefore, before]) => {
    if (words !== wordsBefore) {
      const at = startAt ? list.findIndex((m) => m.id === startAt) : -1
      startAt = null
      index.value = Math.max(0, at)
      void go()
      return
    }
    const id = before?.[index.value]?.id
    const at = id ? list.findIndex((m) => m.id === id) : -1
    if (at >= 0) index.value = at
    else if (index.value >= list.length) index.value = Math.max(0, list.length - 1)
    // Ничего не было, а теперь есть — к первому найденному.
    if (!before?.length && list.length) void go()
  })

  function older(): void {
    flush()
    if (index.value >= hits.value.length - 1) return
    index.value += 1
    void go()
  }

  function newer(): void {
    flush()
    if (index.value <= 0) return
    index.value -= 1
    void go()
  }

  function clear(): void {
    query.value = ''
    pinned.value = null
    startAt = null
    flush()
  }

  /**
   * Открыть поиск сразу на сообщении: выбрали в поиске по всем чатам. Запрос
   * тот же, стрелки дальше перебирают найденное в этом чате.
   */
  function openAt(text: string, message: Message): void {
    if (timer) clearTimeout(timer)
    timer = null
    pinned.value = message
    startAt = message.id
    query.value = text
    // Новый массив, даже если слова те же: встать нужно на это сообщение.
    tokens.value = searchTokens(text)
  }

  return {
    query,
    tokens,
    active,
    hits,
    index,
    current,
    currentId,
    opening,
    older,
    newer,
    clear,
    openAt,
  }
}
