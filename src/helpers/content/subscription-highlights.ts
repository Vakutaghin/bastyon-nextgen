/**
 * «Новое от подписок» наверху главной ленты — как `includesub` старого клиента
 * (components/lenta): какие посты подписок человек уже видел. Видел —
 * диапазон id постов от самого старого до самого нового, которые он
 * пролистал (sharesObserver старого клиента: `first` — самый новый, `last` —
 * самый старый). Непросмотренные — новее или старше этого диапазона.
 *
 * Хранится на устройстве, по аккаунту.
 */

export interface SeenRange {
  /** id самого нового просмотренного поста. */
  first: number
  /** id самого старого просмотренного поста. */
  last: number
}

const STORAGE_KEY = 'bastyon_subscriptions_seen'

function numericIds(posts: readonly { id: string | number }[]): number[] {
  return posts.map((p) => Number(p.id)).filter((id) => Number.isFinite(id) && id > 0)
}

/**
 * Старше этого посты подписок «новыми» не считаются. Иначе тому, кто подписан
 * на одного-двух редко пишущих (у старых аккаунтов в подписках обычно
 * Bastyon_Team — его предлагала регистрация), наверх ленты вставали посты
 * за несколько месяцев: со стороны это выглядело как чужая лента вместо своей.
 */
export const HIGHLIGHT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Свежие посты: не старше HIGHLIGHT_MAX_AGE_MS к `now`. */
export function recentPosts<T extends { timestamp?: string }>(
  posts: readonly T[],
  now: number = Date.now()
): T[] {
  return posts.filter((p) => {
    const time = p.timestamp ? Date.parse(p.timestamp) : NaN
    return Number.isFinite(time) && now - time <= HIGHLIGHT_MAX_AGE_MS
  })
}

/** Посты на языках ленты; без языка в записи — тоже (не прятать то, о чём не знаем). */
export function inLanguage<T extends { language?: string }>(
  posts: readonly T[],
  lang: string | readonly string[]
): T[] {
  const langs: readonly string[] = typeof lang === 'string' ? [lang] : lang
  return posts.filter((p) => !p.language || langs.includes(p.language))
}

/** Посты подписок, которых человек ещё не видел. */
export function unseenPosts<T extends { id: string | number }>(
  posts: readonly T[],
  seen: SeenRange | null
): T[] {
  if (!seen) return [...posts]
  return posts.filter((p) => {
    const id = Number(p.id)
    return !Number.isFinite(id) || id > seen.first || id < seen.last
  })
}

/** Просмотренное после того, как пролистали `posts`: диапазон только растёт. */
export function widenSeen(
  seen: SeenRange | null,
  posts: readonly { id: string | number }[]
): SeenRange | null {
  const ids = numericIds(posts)
  if (!ids.length) return seen
  const first = Math.max(...ids)
  const last = Math.min(...ids)
  if (!seen) return { first, last }
  return { first: Math.max(seen.first, first), last: Math.min(seen.last, last) }
}

function readAll(): Record<string, SeenRange> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, SeenRange>) : {}
  } catch {
    return {}
  }
}

export function loadSeen(address: string): SeenRange | null {
  const range = readAll()[address]
  return range && Number.isFinite(range.first) && Number.isFinite(range.last) ? range : null
}

export function saveSeen(address: string, range: SeenRange | null): void {
  if (!address || !range) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [address]: range }))
  } catch {
    // Хранилище недоступно (приватное окно): посты подписок покажутся снова.
  }
}
