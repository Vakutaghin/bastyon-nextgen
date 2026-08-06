/**
 * Конвертация оптимистичного PendingPost → рендер-модель ленты AdaptedPost.
 *
 * Аналог pending-comments.ts (pendingToGetComment) в слое комментариев: pending
 * хранится компактно в сторе, а для карточки поста разворачивается в AdaptedPost
 * с флагом `pending: true`, по которому PostCard рисует бейдж «не опубликовано».
 */

import type { AdaptedPost } from '@/composables/use-feed'
import type { PendingPost } from '@/stores/pending-posts-store'

/** Типы операций Pocketnet, соответствующие публикации поста (для матча WS-события). */
export const POST_OP_TYPES: readonly string[] = ['share', 'video', 'audio', 'article']

/** Является ли тип WS-транзакции публикацией поста. */
export function isPostOpType(type?: string): boolean {
  return !!type && POST_OP_TYPES.includes(type)
}

/** Разворачивает pending-пост в AdaptedPost для рендера в ленте профиля. */
export function pendingPostToAdapted(
  pending: PendingPost,
  author: AdaptedPost['author']
): AdaptedPost {
  return {
    id: pending.id,
    txid: pending.id,
    author,
    title: pending.caption,
    content: pending.message,
    timestamp: new Date(pending.createdAt).toISOString(),
    likes: 0,
    comments: 0,
    shares: 0,
    tags: pending.tags,
    type: pending.type,
    category: '',
    images: pending.images,
    ratingStars: 0,
    scoreCnt: 0,
    videoUrl: pending.url,
    pending: true,
  }
}
