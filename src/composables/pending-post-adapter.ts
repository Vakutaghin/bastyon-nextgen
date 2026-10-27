/**
 * Конвертация оптимистичного PendingPost → рендер-модель ленты AdaptedPost.
 *
 * Аналог pending-comments.ts (pendingToGetComment) в слое комментариев: pending
 * хранится компактно в сторе, а для карточки поста разворачивается в AdaptedPost
 * с флагом `pending: true`, по которому PostCard рисует бейдж «не опубликовано»
 * (`txFailed` — «не попал в блокчейн»; подтверждённый — без пометки).
 */

import type { AdaptedPost } from '@/composables/use-feed'
import type { PendingPost } from '@/stores/pending-posts-store'

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
    // В блоке — обычный пост: ждёт только, когда лента профиля отдаст его сама.
    // Не попавший в блок остаётся неопубликованным: без оценок и комментариев.
    pending: !pending.confirmedAt,
    ...(pending.failed ? { txFailed: true } : {}),
    ...(pending.scheduledAt && !pending.confirmedAt ? { scheduledAt: pending.scheduledAt } : {}),
  }
}
