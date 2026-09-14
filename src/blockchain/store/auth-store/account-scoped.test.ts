// X9: одна точка сброса пер-аккаунтных сторов — каждый из них действительно сбрасывается.

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
  })
})
