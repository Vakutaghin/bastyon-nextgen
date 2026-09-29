/**
 * @-меншены для простого композера: детект токена `@query` у курсора,
 * подсказки и вставка `@<имя>` в позицию токена.
 *
 * Подсказки сначала свои и мгновенные: подписки и люди, чьи имена приложение
 * уже знает (лента, комментарии, профили), — с первой же `@`. Поиск по сети
 * (`searchusers`) — после паузы в наборе и от двух букв: нода ищет по всему
 * тексту профиля 0,5–5 с, а на каждую букву уходил отдельный запрос, и
 * короткие она обрывает по таймауту SQL. 29.09.2026 список появлялся через
 * 3–4 с после ввода, и казалось, что подсказок нет вовсе. Пока сеть ищет, а
 * своих совпадений нет, список говорит «Ищу…». Из ответа сети берутся только
 * те, чьё имя содержит набранное: остальные нашлись по тексту «О себе».
 *
 * Детектор {@link detectMentionToken} и ранжирование {@link rankMentions} —
 * чистые функции (юнит-тест без DOM).
 */

import { computed, getCurrentScope, nextTick, onScopeDispose, ref, watch } from 'vue'
import { useSearchUsers } from '@/composables/use-search-query'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { knownUsers, preloadUserNames, rememberUsers } from '@/services/user-names'
import { useAuthStore, useUserRelationsStore } from '@/stores'

export interface MentionToken {
  /** Текст после `@` до курсора. */
  query: string
  /** Индекс символа `@`. */
  start: number
  /** Индекс курсора (конец токена). */
  end: number
}

/** Кого можно упомянуть: имя обязательно — в текст уходит `@имя`. */
export interface MentionCandidate {
  address: string
  name: string
  avatar: string | null
}

const MENTION_CHAR = /[A-Za-z0-9_]/
/** Строк в списке. */
export const MENTION_LIMIT = 6
/** Сеть спрашиваем от двух букв… */
export const MENTION_SEARCH_MIN_LENGTH = 2
/** …и когда набор замер: не на каждую букву. */
export const MENTION_SEARCH_DELAY_MS = 300
/** Имена подписок догружаются один раз, не больше стольких адресов. */
const FOLLOWED_NAMES_LIMIT = 300

/**
 * Находит активный `@`-токен, заканчивающийся на позиции курсора.
 * `@` должен стоять в начале строки или после пробела (чтобы не ловить e-mail).
 */
export function detectMentionToken(text: string, caret: number): MentionToken | null {
  if (caret < 0 || caret > text.length) return null
  let i = caret - 1
  while (i >= 0 && MENTION_CHAR.test(text[i]!)) i--
  if (i < 0 || text[i] !== '@') return null
  if (i > 0 && !/\s/.test(text[i - 1]!)) return null
  return { query: text.slice(i + 1, caret), start: i, end: caret }
}

/**
 * Список подсказок: сначала имена, которые начинаются с набранного (подписки
 * впереди, короткие — выше), потом те, где набранное внутри. Свои кандидаты
 * раньше сетевых, повторы по адресу отбрасываются, без имени — не подсказка.
 */
export function rankMentions(
  query: string,
  local: readonly MentionCandidate[],
  remote: readonly MentionCandidate[],
  followed: ReadonlySet<string>,
  limit = MENTION_LIMIT
): MentionCandidate[] {
  const q = query.toLowerCase()
  const seen = new Set<string>()
  const tiers: MentionCandidate[][] = [[], [], [], []]
  for (const candidate of [...local, ...remote]) {
    const name = candidate.name.trim()
    if (!name || seen.has(candidate.address)) continue
    const lower = name.toLowerCase()
    const starts = lower.startsWith(q)
    if (!starts && !lower.includes(q)) continue
    seen.add(candidate.address)
    const isFollowed = followed.has(candidate.address)
    tiers[starts ? (isFollowed ? 0 : 1) : isFollowed ? 2 : 3]!.push({ ...candidate, name })
  }
  // Среди начинающихся с набранного ближе то, что короче: «kr» раньше «kreyser001».
  // Одна «@» без букв — подписки как есть, длина имени там ничего не значит.
  if (q)
    for (const tier of [tiers[0]!, tiers[1]!]) tier.sort((a, b) => a.name.length - b.name.length)
  return tiers.flat().slice(0, limit)
}

interface Options {
  /** Текущий текст композера. */
  getText: () => string
  /** DOM <textarea> для чтения курсора и фокуса. */
  getEl: () => HTMLTextAreaElement | null
  /** Записать новый текст в модель композера. */
  setText: (value: string) => void
}

export function useComposerMentions(opts: Options) {
  const token = ref<MentionToken | null>(null)
  const query = computed(() => token.value?.query ?? '')
  const highlight = ref(0)

  // Сеть — после паузы в наборе и от двух букв.
  const searchQuery = ref('')
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  watch(query, (q) => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = null
    if (q.length < MENTION_SEARCH_MIN_LENGTH) {
      searchQuery.value = ''
      return
    }
    searchTimer = setTimeout(() => {
      searchQuery.value = q
    }, MENTION_SEARCH_DELAY_MS)
  })
  if (getCurrentScope()) onScopeDispose(() => searchTimer && clearTimeout(searchTimer))

  // Нода отдаёт до 20 человек, сколько бы ни попросили.
  const { data, isFetching } = useSearchUsers(searchQuery, 20)
  // Найденные в сети становятся «своими»: в следующий раз подскажутся сразу.
  watch(data, (list) => {
    if (Array.isArray(list) && list.length) rememberUsers(list)
  })

  const authStore = useAuthStore()
  const relations = useUserRelationsStore()
  let followedRequested = false
  /** Имена подписок — один раз за композер, когда впервые понадобились. */
  function loadFollowedNames(): void {
    if (followedRequested || !authStore.isUserAuthenticated) return
    followedRequested = true
    void relations
      .init()
      .then(() => preloadUserNames([...relations.subscribed].slice(0, FOLLOWED_NAMES_LIMIT)))
      .catch((e: unknown) => console.warn('[mentions] followed names failed', e))
  }

  const local = computed<MentionCandidate[]>(() => (token.value ? knownUsers() : []))
  const remote = computed<MentionCandidate[]>(() =>
    (data.value ?? []).map((user) => ({
      address: user.address,
      name: String(user.name ?? '').trim(),
      avatar: resolveImageUrl(user.i) ?? null,
    }))
  )

  const results = computed<MentionCandidate[]>(() =>
    token.value ? rankMentions(query.value, local.value, remote.value, relations.subscribed) : []
  )
  /** Сеть ещё ищет то, что набрано сейчас. */
  const searching = computed(
    () =>
      !!token.value &&
      query.value.length >= MENTION_SEARCH_MIN_LENGTH &&
      (searchQuery.value !== query.value || isFetching.value)
  )
  const show = computed<boolean>(
    () => !!token.value && (results.value.length > 0 || searching.value)
  )

  watch(results, (list) => {
    if (highlight.value >= list.length) highlight.value = 0
  })

  /** Пересчитать токен по текущему тексту и позиции курсора. */
  function update(): void {
    const el = opts.getEl()
    const text = opts.getText()
    const caret = el ? (el.selectionStart ?? text.length) : text.length
    const next = detectMentionToken(text, caret)
    if (next?.query !== token.value?.query) highlight.value = 0
    token.value = next
    if (next) loadFollowedNames()
  }

  function close(): void {
    token.value = null
  }

  function move(dir: 1 | -1): void {
    const n = results.value.length
    if (n === 0) return
    highlight.value = (highlight.value + dir + n) % n
  }

  function select(user: MentionCandidate): void {
    const tk = token.value
    if (!tk) return
    const handle = user.name.trim()
    if (!handle) {
      close()
      return
    }
    const text = opts.getText()
    const insert = `@${handle} `
    opts.setText(text.slice(0, tk.start) + insert + text.slice(tk.end))
    const pos = tk.start + insert.length
    close()
    void nextTick(() => {
      const el = opts.getEl()
      if (!el) return
      el.focus()
      try {
        el.setSelectionRange(pos, pos)
      } catch {
        /* noop */
      }
    })
  }

  /** Обработчик keydown textarea. Возвращает true, если событие перехвачено. */
  function onKeydown(e: KeyboardEvent): boolean {
    if (!show.value) return false
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        return true
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        return true
      case 'Enter':
      case 'Tab': {
        const user = results.value[highlight.value]
        if (user) {
          e.preventDefault()
          select(user)
          return true
        }
        return false
      }
      case 'Escape':
        e.preventDefault()
        close()
        return true
      default:
        return false
    }
  }

  return { show, results, searching, highlight, update, close, select, onKeydown }
}
