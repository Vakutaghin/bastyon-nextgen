// «Новые ролики подписок — сами»: что качать и что пора убрать. Решает стор
// (offline-videos-store, runAuto): когда приложение открыто, на Wi-Fi, раз в
// час и при возвращении в приложение; служба Android докачивает в фоне.

import type { OfflineItem } from './types'

/** Сколько роликов ставить за одну проверку. */
export const AUTO_PER_CHECK = 5
/** Больше скольких скачанных само не держать: новые ждут, пока старые уйдут. */
export const AUTO_MAX_ITEMS = 20
/** Скачанное само живёт неделю, если не нажать «Оставить». */
export const AUTO_KEEP_MS = 7 * 24 * 60 * 60 * 1000
/** Первая проверка берёт ролики за последние сутки. */
export const AUTO_FIRST_WINDOW_MS = 24 * 60 * 60 * 1000
/** Сколько должно остаться свободным после загрузки: диск сам не забиваем. */
export const AUTO_MIN_FREE_BYTES = 2 * 1024 * 1024 * 1024
/** Качество, если по умолчанию стоит «Спрашивать». */
export const AUTO_DEFAULT_HEIGHT = 360

/** Пост ленты подписок — сколько нужно, чтобы решить. */
export interface AutoCandidate {
  type?: string
  videoUrl?: string
  /** ISO, как у AdaptedPost. */
  timestamp?: string
}

export function postTimeMs(post: AutoCandidate): number {
  const ms = post.timestamp ? Date.parse(post.timestamp) : NaN
  return Number.isFinite(ms) ? ms : 0
}

/**
 * Новые ролики (не треки, не трансляции) после `since`, свежие первыми, без
 * уже скачанного и без повторов; не больше `limit`.
 */
export function autoCandidates<T extends AutoCandidate>(
  posts: readonly T[],
  options: { since: number; have: (url: string) => boolean; limit: number }
): T[] {
  const seen = new Set<string>()
  return posts
    .filter((p) => {
      const url = p.videoUrl ?? ''
      if (p.type !== 'video' || !url.startsWith('peertube://') || url.endsWith('/stream'))
        return false
      if (postTimeMs(p) <= options.since || seen.has(url) || options.have(url)) return false
      seen.add(url)
      return true
    })
    .sort((a, b) => postTimeMs(b) - postTimeMs(a))
    .slice(0, Math.max(0, options.limit))
}

/** Скачанное само этим аккаунтом. */
export function autoItems(items: Iterable<OfflineItem>, account: string): OfflineItem[] {
  return [...items].filter((i) => !!i.meta.auto && i.meta.accounts?.includes(account))
}

/** Скачанное само, которому пора уйти: неделя прошла, «Оставить» не нажимали. */
export function expiredAuto(
  items: Iterable<OfflineItem>,
  account: string,
  now: number
): OfflineItem[] {
  return autoItems(items, account).filter((i) => now - (i.meta.auto ?? now) >= AUTO_KEEP_MS)
}
