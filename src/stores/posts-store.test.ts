import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePostsStore } from './posts-store'

describe('posts-store', () => {
  let store: ReturnType<typeof usePostsStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = usePostsStore()
  })

  describe('registerPost', () => {
    it('registers a post by id', () => {
      store.registerPost({ id: '1', likes: 0 })
      expect(store.getPost('1')).toBeDefined()
      expect(store.getPost('1')!.id).toBe('1')
    })

    it('registers txid mapping', () => {
      store.registerPost({ id: '1', txid: 'tx123' })
      expect(store.getPostByShareId('tx123')).toBeDefined()
    })

    it('registers hash mapping', () => {
      store.registerPost({ id: '1', hash: 'hash123' })
      expect(store.getPostByShareId('hash123')).toBeDefined()
    })

    it('does not register post without id', () => {
      store.registerPost({ likes: 5 })
      expect(store.posts.size).toBe(0)
    })
  })

  describe('updatePost', () => {
    it('updates post fields', () => {
      store.registerPost({ id: '1', likes: 0 })
      store.updatePost('1', { likes: 10 })
      expect(store.getPost('1')!.likes).toBe(10)
    })

    it('updates via txid lookup', () => {
      store.registerPost({ id: '1', txid: 'tx1' })
      store.updatePost('tx1', { likes: 5 })
      expect(store.getPost('1')!.likes).toBe(5)
    })

    it('does nothing for unknown post', () => {
      store.updatePost('unknown', { likes: 5 })
      expect(store.posts.size).toBe(0)
    })
  })

  describe('likePost', () => {
    it('adds like (toggle on)', () => {
      store.registerPost({ id: '1', likes: 0 })
      store.likePost('1')
      expect(store.isPostLiked('1')).toBe(true)
      expect(store.getPost('1')!.likes).toBe(1)
    })

    it('removes like (toggle off)', () => {
      store.registerPost({ id: '1', likes: 0 })
      store.likePost('1') // like — likes becomes 1
      expect(store.isPostLiked('1')).toBe(true)
      expect(store.getPost('1')!.likes).toBe(1)
      store.likePost('1') // unlike — likes becomes max(0, 1-1) = 0
      expect(store.isPostLiked('1')).toBe(false)
      expect(store.getPost('1')!.likes).toBe(0)
    })

    it('does not go below 0 likes', () => {
      store.registerPost({ id: '1', likes: 0 })
      store.likePost('1') // like
      store.likePost('1') // unlike — likes should be max(0, -1) = 0
      expect(store.getPost('1')!.likes).toBe(0)
    })
  })

  describe('commentPost', () => {
    it('increments comment count', () => {
      store.registerPost({ id: '1', comments: 0 })
      store.commentPost('1')
      expect(store.getPost('1')!.comments).toBe(1)
    })

    it('handles undefined comments', () => {
      store.registerPost({ id: '1' })
      store.commentPost('1')
      expect(store.getPost('1')!.comments).toBe(1)
    })
  })

  describe('sharePost', () => {
    it('toggles share on', () => {
      store.registerPost({ id: '1', shares: 0 })
      store.sharePost('1')
      expect(store.isPostShared('1')).toBe(true)
      expect(store.getPost('1')!.shares).toBe(1)
    })

    it('toggles share off', () => {
      store.registerPost({ id: '1', shares: 1 })
      store.sharePost('1')
      store.sharePost('1')
      expect(store.isPostShared('1')).toBe(false)
    })
  })

  describe('removePost', () => {
    it('removes post and all mappings', () => {
      store.registerPost({ id: '1', txid: 'tx1', hash: 'h1' })
      store.likePost('1')
      store.sharePost('1')
      store.removePost('1')

      expect(store.getPost('1')).toBeUndefined()
      expect(store.getPostByShareId('tx1')).toBeUndefined()
      expect(store.isPostLiked('1')).toBe(false)
      expect(store.isPostShared('1')).toBe(false)
    })
  })

  describe('clearPosts', () => {
    it('clears all data', () => {
      store.registerPost({ id: '1' })
      store.registerPost({ id: '2' })
      store.likePost('1')
      store.clearPosts()

      expect(store.posts.size).toBe(0)
      expect(store.likedPosts.size).toBe(0)
      expect(store.sharedPosts.size).toBe(0)
    })
  })

  describe('getPostByShareId', () => {
    it('finds by direct id', () => {
      store.registerPost({ id: '1' })
      expect(store.getPostByShareId('1')).toBeDefined()
    })

    it('finds by txid', () => {
      store.registerPost({ id: '1', txid: 'tx1' })
      expect(store.getPostByShareId('tx1')).toBeDefined()
    })

    it('returns undefined for unknown', () => {
      expect(store.getPostByShareId('unknown')).toBeUndefined()
    })
  })
})
