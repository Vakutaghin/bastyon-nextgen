/**
 * Маппинг данных поста из API формата в UI формат.
 * Вынесено из feed-store для повторного использования в composables и сторах.
 */

import type { AdaptedPost } from '@/types/adapted-post'

/** Канонический контракт поста — см. `@/types/adapted-post`. */
export type { AdaptedPost }

// Адаптер один на всё приложение (S22/X3) — см. `adapt-post.ts`. Здесь
// остаётся только извлечение сырых постов из разных форматов ответа.
export type { RawUserProfile, RawFeedPost } from './adapt-post'
export { adaptPostData, mergeRepostContent } from './adapt-post'

import type { RawFeedPost } from './adapt-post'

/** Возможные формы ответа ленты, из которых извлекаются сырые посты. */
interface RawFeedResponse {
  data?: { contents?: RawFeedPost[] } | RawFeedPost[]
  result?: RawFeedPost[]
  posts?: RawFeedPost[]
  contents?: RawFeedPost[]
  /** Прочие поля разных форматов ответа API игнорируются. */
  [key: string]: unknown
}

/**
 * Извлекает массив сырых постов из различных форматов ответа API
 */
export function extractRawPosts(
  feedData: RawFeedResponse | RawFeedPost[] | null | undefined
): RawFeedPost[] {
  if (!feedData) return []
  if (Array.isArray(feedData)) return feedData
  const data = feedData.data
  if (data && !Array.isArray(data) && Array.isArray(data.contents)) return data.contents
  if (Array.isArray(data)) return data
  if (Array.isArray(feedData.result)) return feedData.result
  if (Array.isArray(feedData.posts)) return feedData.posts
  if (Array.isArray(feedData.contents)) return feedData.contents
  return []
}
