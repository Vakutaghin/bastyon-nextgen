// X9: одна точка сброса пер-аккаунтных сторов — каждый из них действительно сбрасывается,
// а посты нового аккаунта, ждущие блока, поднимаются из хранилища.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores', () => ({
  useAuthStore: () => ({ getUserAddress: 'PA', isUserAuthenticated: true }),
}))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ getUserAddress: 'PA', isUserAuthenticated: true }),
}))
vi.mock('@/blockchain', () => ({
  useAuthStore: () => ({ getUserAddress: 'PA', isUserAuthenticated: true }),
}))

import { resetAccountScopedStores } from './account-scoped'
import { useUserRelationsStore } from '@/stores/user-relations-store'
import { usePendingPostsStore } from '@/stores/pending-posts-store'
import { useCommentsStore } from '@/stores/comments-store'
import { usePendingRatingsStore } from '@/stores/pending-ratings-store'
import { useNotificationsStore } from '@/stores/notifications-store'
import { usePostsStore } from '@/stores/posts-store'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'

describe('resetAccountScopedStores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('сбрасывает relations, pending-посты/комментарии/оценки, уведомления и posts-store', async () => {
    const relations = useUserRelationsStore()
    relations.isInitialized = true
    relations.blocked = new Set(['PBad'])
    const pendingPosts = usePendingPostsStore()
    pendingPosts.pendingByAddress = { PA: [] }
    const comments = useCommentsStore()
    comments.deletedCommentIds = { c1: true }
    const ratings = usePendingRatingsStore()
    ratings.isInitialized = true
    ratings.initedForAddress = 'PA'
    const notifications = useNotificationsStore()
    notifications.inited = true
    notifications.initedForAddress = 'PA'
    const posts = usePostsStore()
    posts.posts.set('1', { id: '1', myVal: 5 } as never)
    const paid = usePaidSubscriptionsStore()
    paid.myPayments = []
    paid.rememberSettings('PAuthor', { paidsubscription: 5 })

    await resetAccountScopedStores()

    expect(relations.isInitialized).toBe(false)
    expect(relations.blocked.size).toBe(0)
    expect(pendingPosts.pendingByAddress).toEqual({})
    expect(comments.deletedCommentIds).toEqual({})
    expect(ratings.isInitialized).toBe(false)
    expect(ratings.initedForAddress).toBeNull()
    expect(notifications.inited).toBe(false)
    expect(notifications.initedForAddress).toBeNull()
    expect(posts.posts.size).toBe(0)
    expect(paid.myPayments).toBeNull()
    expect(paid.priceOf('PAuthor')).toBeUndefined()
  })

  it('при входе в аккаунт сразу грузит его блок-лист и подписки', async () => {
    const relations = useUserRelationsStore()
    const init = vi.spyOn(relations, 'init').mockResolvedValue()

    await resetAccountScopedStores()
    expect(init).not.toHaveBeenCalled()

    await resetAccountScopedStores('PB')
    expect(init).toHaveBeenCalledTimes(1)
  })

  it('посты нового аккаунта, ждущие блока, — с прошлого запуска, чужие — нет', async () => {
    localStorage.clear()
    const saved = (id: string, address: string) => ({
      id,
      address,
      caption: '',
      message: id,
      images: [],
      tags: [],
      type: 'share',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
    })
    localStorage.setItem('BST_PENDING_POSTS_PB', JSON.stringify([saved('tx-b', 'PB')]))
    localStorage.setItem('BST_PENDING_POSTS_PA', JSON.stringify([saved('tx-a', 'PA')]))

    await resetAccountScopedStores('PB')
    const pendingPosts = usePendingPostsStore()
    expect(pendingPosts.allPending.map((p) => p.id)).toEqual(['tx-b'])
  })
})
