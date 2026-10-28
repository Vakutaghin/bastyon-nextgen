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
