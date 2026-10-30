/**
 * Поиск в списке чатов: свои переписки, группы и каналы по названию — сразу,
 * люди Bastyon (`searchusers`) — когда ввод замер. Пока ждём паузу и ответ,
 * крутится значок загрузки; ответ на устаревший запрос отбрасывается.
 */

import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { searchUsers } from '@/services/search-service'
import type { SearchUserResult } from '@/types/rpc-responses/search-users'

/** Своих чатов в выдаче — не больше. */
export const LOCAL_LIMIT = 5
/** Людей из сети — не больше. */
export const GLOBAL_LIMIT = 15
export const SEARCH_DEBOUNCE_MS = 350
/** С одной буквы сеть отдаёт случайных людей — ищем с двух. */
export const GLOBAL_MIN_LENGTH = 2

export function normalizeForSearch(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase().replace(/ё/g, 'е').trim()
}

export interface SearchCandidate<T> {
  item: T
  name: string
}

/**
 * Сначала названия, которые начинаются с запроса, потом — где с него
 * начинается слово, потом — где он внутри. Внутри группы порядок списка:
 * свежие переписки выше.
 */
export function matchCandidates<T>(
  candidates: readonly SearchCandidate<T>[],
  query: string,
  limit = LOCAL_LIMIT
): T[] {
  const q = normalizeForSearch(query)
  if (!q) return []
  const tiers: T[][] = [[], [], []]
  for (const c of candidates) {
    const name = normalizeForSearch(c.name)
    const at = name.indexOf(q)
    if (at < 0) continue
    const tier = at === 0 ? 0 : /[\s\p{P}]/u.test(name[at - 1] ?? '') ? 1 : 2
    tiers[tier]!.push(c.item)
  }
  return tiers.flat().slice(0, limit)
}

export function useChatSearch<T>(
  candidates: Ref<readonly SearchCandidate<T>[]>,
  myAddress: () => string | null | undefined,
  /** Поле открывают снаружи — лупой в шапке мессенджера. */
  isOpen: Ref<boolean> = ref(false)
) {
  const query = ref('')
  const people = ref<SearchUserResult[]>([])
  const peopleLoading = ref(false)
  /** Сеть ответила на текущий запрос (пусто — значит «никого»). */
  const peopleDone = ref(false)
  const peopleFailed = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0

  const isSearching = computed<boolean>(() => isOpen.value && !!query.value.trim())
  const chats = computed<T[]>(() => matchCandidates(candidates.value, query.value))
  const tooShort = computed<boolean>(() => query.value.trim().length < GLOBAL_MIN_LENGTH)

  function cancelPending(): void {
    if (timer) clearTimeout(timer)
    timer = null
    seq += 1
  }

  async function runSearch(q: string, id: number): Promise<void> {
    try {
      // Себя в выдаче не показываем — запас в один, чтобы не потерять место.
      const found = await searchUsers(q, { count: GLOBAL_LIMIT + 1 })
      if (id !== seq) return
      const me = myAddress()
      people.value = found.filter((u) => u.address && u.address !== me).slice(0, GLOBAL_LIMIT)
      peopleFailed.value = false
    } catch {
      if (id !== seq) return
      people.value = []
      peopleFailed.value = true
    } finally {
      if (id === seq) {
        peopleLoading.value = false
        peopleDone.value = true
      }
    }
  }

  watch(query, (value) => {
    cancelPending()
    const q = value.trim()
    peopleDone.value = false
    peopleFailed.value = false
    if (q.length < GLOBAL_MIN_LENGTH) {
      people.value = []
      peopleLoading.value = false
      return
    }
    peopleLoading.value = true
    const id = seq
    timer = setTimeout(() => {
      timer = null
      void runSearch(q, id)
    }, SEARCH_DEBOUNCE_MS)
  })

  // Закрыли лупой в шапке — запрос стираем, как и крестиком в поле.
  watch(isOpen, (open) => {
    if (!open) query.value = ''
  })

  function open(): void {
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
    query.value = ''
  }

  onBeforeUnmount(cancelPending)

  return {
    isOpen,
    query,
    isSearching,
    chats,
    tooShort,
    people,
    peopleLoading,
    peopleDone,
    peopleFailed,
    open,
    close,
  }
}
