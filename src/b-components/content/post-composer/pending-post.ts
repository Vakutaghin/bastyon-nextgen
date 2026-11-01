// Пост ушёл в сеть: окно поста и окно загрузки ролика кладут его в
// pending-слой одинаково.

import { useAuthStore } from '@/blockchain'
import { resolvePostOperationType, type SharePostData } from '@/blockchain/core/actions/post-action'
import { pendingPostDeadline, usePendingPostsStore } from '@/stores'

/**
 * Оптимистичная публикация: пост уже в мемпуле (есть txid), но ещё не в
 * блокчейне. Автор сразу видит его в своей ленте профиля с пометкой «не
 * опубликовано» и в «песочных часах». Правку не кладём: это не новый пост.
 */
export function trackPendingPost(post: SharePostData, txid: string): void {
  const address = useAuthStore().getUserAddress
  if (post.txidEdit || !address) return
  const now = Date.now()
  const scheduledAt = post.settings?.t && post.settings.t > 1 ? post.settings.t * 1000 : undefined
  usePendingPostsStore().addPending({
    id: txid,
    address,
    caption: post.caption ?? '',
    message: typeof post.message === 'string' ? post.message : '',
    images: post.images ?? [],
    tags: post.tags ?? [],
    url: post.url,
    type: resolvePostOperationType(post),
    createdAt: now,
    ...(scheduledAt ? { scheduledAt } : {}),
    expiresAt: pendingPostDeadline(now, scheduledAt),
  })
}
