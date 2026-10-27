/**
 * Список «Медиастудии»: поиск, фильтр, сортировка и вид (плитка или список,
 * как «Контент» в творческой студии YouTube). Вид запоминается на устройстве.
 */

import type { ServerVideo } from './use-server-videos'

export type StudioView = 'grid' | 'list'
/** Без поста — и не в посте, и пост с ним ещё не отправлен. */
export type StudioFilter = 'all' | 'posted' | 'unposted'
export type StudioSort = 'newest' | 'oldest' | 'views' | 'name'

export const STUDIO_VIEW_KEY = 'bastyon_media_studio_view'

export function loadStudioView(): StudioView {
  try {
    return localStorage.getItem(STUDIO_VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function saveStudioView(view: StudioView): void {
  try {
    localStorage.setItem(STUDIO_VIEW_KEY, view)
  } catch {
    // Хранилище закрыто (приватный режим) — вид просто не запомнится.
  }
}

const normalize = (text: string): string => text.toLocaleLowerCase().replace(/ё/g, 'е').trim()

export interface StudioQuery {
  search: string
  filter: StudioFilter
  sort: StudioSort
  /** Пост с роликом отправлен и ждёт блока. */
  isPublishing: (video: ServerVideo) => boolean
}

export function studioVideos(videos: ServerVideo[], query: StudioQuery): ServerVideo[] {
  const words = normalize(query.search).split(/\s+/).filter(Boolean)
  const matches = (video: ServerVideo): boolean => {
    if (!words.length) return true
    const text = normalize(
      [video.name, video.description, ...video.posts.map((post) => post.caption)].join(' ')
    )
    return words.every((word) => text.includes(word))
  }
  const inPost = (video: ServerVideo): boolean => video.posted || query.isPublishing(video)
  const shown = videos.filter((video) => {
    if (query.filter === 'posted' && !inPost(video)) return false
    if (query.filter === 'unposted' && inPost(video)) return false
    return matches(video)
  })
  const byName = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
  const order: Record<StudioSort, (a: ServerVideo, b: ServerVideo) => number> = {
    newest: (a, b) => b.time - a.time,
    oldest: (a, b) => a.time - b.time,
    // Неизвестное число просмотров — в конце.
    views: (a, b) => (b.views ?? -1) - (a.views ?? -1) || b.time - a.time,
    name: (a, b) => byName.compare(a.name, b.name),
  }
  return [...shown].sort(order[query.sort])
}

/** Сводка над списком: сколько роликов и просмотров. */
export function studioTotals(videos: ServerVideo[]): { count: number; views: number } {
  return {
    count: videos.length,
    views: videos.reduce((sum, video) => sum + (video.views ?? 0), 0),
  }
}
