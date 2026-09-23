/**
 * Типы и хелперы для работы с лентой постов
 *
 * Composables ленты — use-infinite-feed / use-profile-feed / use-boosted-feed.
 */

import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import type { GetTopFeedResponse } from '@/types/rpc-responses/get-top-feed'
import type {
  GetProfileFeedResponse,
  GetProfileFeedData,
} from '@/types/rpc-responses/get-profile-feed'
import type { AdaptedPost } from '@/types/adapted-post'
import { safeDecode } from '@/helpers/content/safe-decode'

/** Канонический контракт поста — см. `@/types/adapted-post`. */
export type { AdaptedPost }

/** Декодер полей поста — канонический `safeDecode` (семантика legacy `trydecode`). */
export { safeDecode }

// Адаптация поста и merge репоста живут в одном общем модуле (S22/X3) —
// здесь только реэкспорт, чтобы существующие импорты `@/composables/use-feed`
// продолжали работать.
export type { RawUserProfile, RawFeedPost } from '@/helpers/common/adapt-post'
export { adaptPostData, mergeRepostContent } from '@/helpers/common/adapt-post'

import { adaptPostData } from '@/helpers/common/adapt-post'
import type { RawFeedPost, RawUserProfile } from '@/helpers/common/adapt-post'

/**
 * Преобразует данные API в массив адаптированных постов
 */
export function extractPostsFromResponse(
  feedData:
    | GetTopFeedResponse
    | GetHierarchicalStripResponse
    | GetProfileFeedResponse
    | GetProfileFeedData
    | null
    | undefined
): AdaptedPost[] {
  if (!feedData) {
    return []
  }

  let rawPosts: RawFeedPost[]
  const usersMap: Record<string, RawUserProfile> = {}

  // Сырой контент может приходить в разных формах (пост или профиль пользователя);
  // на уровне типов работаем с пересечением полей, реально доступных адаптеру.
  // feedData — строго типизированный union ответов, но в рантайме код защитно
  // проверяет нестандартные формы (массив, .posts, .contents), поэтому читаем
  // через индексируемую запись.
  type RawFeedItem = RawFeedPost & RawUserProfile
  const feedRecord = feedData as unknown as Record<string, unknown>
  const data = feedRecord.data as
    | { contents?: RawFeedItem[]; users?: RawUserProfile[] }
    | RawFeedItem[]
    | undefined
  const dataUsers = data && !Array.isArray(data) ? data.users : undefined

  // Обработка users из data.users (gethierarchicalstrip, gettopfeed)
  if (Array.isArray(dataUsers)) {
    dataUsers.forEach((u) => {
      if (u.address) {
        usersMap[u.address] = u
      }
    })
  }

  const asArray = (value: unknown): RawFeedItem[] | undefined =>
    Array.isArray(value) ? (value as RawFeedItem[]) : undefined

  /**
   * Отделяет профили от постов и попутно наполняет usersMap. Раньше это делала
   * только ветка `data.contents`, поэтому в остальных форматах профиль попадал
   * в ленту как пустой пост (N14).
   */
  const takePosts = (items: RawFeedItem[]): RawFeedItem[] =>
    items.filter((item) => {
      if (item.name && !item.txid && !item.type) {
        if (item.address) usersMap[item.address] = item
        return false
      }
      return true
    })

  // API может возвращать данные в разных форматах
  if (Array.isArray(feedData)) {
    rawPosts = takePosts(feedData)
  } else if (data && !Array.isArray(data) && Array.isArray(data.contents)) {
    // getprofilefeed может возвращать смешанный контент (посты + профили)
    rawPosts = takePosts(data.contents)
  } else if (Array.isArray(data)) {
    rawPosts = takePosts(data)
  } else if (asArray(feedRecord.result)) {
    rawPosts = takePosts(asArray(feedRecord.result)!)
  } else if (asArray(feedRecord.posts)) {
    rawPosts = takePosts(asArray(feedRecord.posts)!)
  } else if (asArray(feedRecord.contents)) {
    rawPosts = takePosts(asArray(feedRecord.contents)!)
  } else {
    return []
  }

  return rawPosts.map((post, index) => adaptPostData(post, index, usersMap))
}
