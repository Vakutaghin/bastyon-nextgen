import { defineStore } from 'pinia'

interface Post {
  id?: string | number
  txid?: string
  hash?: string
  likes?: number
  comments?: number
  shares?: number
  [key: string]: unknown
}

export const usePostsStore = defineStore('posts', {
  state: () => ({
    posts: new Map<string | number, Post>(),
    txidMap: new Map<string, string | number>(), // txid/hash -> id
    likedPosts: new Set<string | number>(),
    sharedPosts: new Set<string | number>()
  }),

  getters: {
    /**
     * Проверяет, лайкнут ли пост
     */
    isPostLiked(): (postId: string | number) => boolean {
      return (postId: string | number) => {
        return this.likedPosts.has(postId)
      }
    },

    /**
     * Проверяет, поделились ли постом
     */
    isPostShared(): (postId: string | number) => boolean {
      return (postId: string | number) => {
        return this.sharedPosts.has(postId)
      }
    },

    /**
     * Получает пост по ID
     */
    getPost(): (postId: string | number) => Post | undefined {
      return (postId: string | number) => {
        return this.posts.get(postId)
      }
    },

    /**
     * Получает пост по ID или хешу/txid
     */
    getPostByShareId(): (shareId: string | number) => Post | undefined {
      return (shareId: string | number) => {
        // 1. Try direct lookup (if shareId is id)
        const post = this.posts.get(shareId)
        if (post) return post

        // 2. Try lookup via txidMap (if shareId is txid/hash)
        if (typeof shareId === 'string') {
          const id = this.txidMap.get(shareId)
          if (id !== undefined) {
            return this.posts.get(id)
          }
        }

        return undefined
      }
    }
  },

  actions: {
    /**
     * Регистрирует пост в store
     */
    registerPost(post: Post): void {
      if (post.id !== undefined) {
        const existing = this.posts.get(post.id)
        if (existing) {
          // Merge, а не overwrite (P2-2): ре-регистрация из ленты не должна
          // ронять поля, которых нет в её снапшоте (напр. локальный голос/
          // rating/like/comment, обновлённые через updatePost). Затираем
          // только теми полями новой регистрации, что реально определены.
          const merged: Record<string, unknown> = { ...existing }
          for (const [k, v] of Object.entries(post)) {
            if (v !== undefined) merged[k] = v
          }
          this.posts.set(post.id, merged as Post)
        } else {
          this.posts.set(post.id, { ...post })
        }

        // Register mapping for txid/hash
        if (post.txid && post.txid !== post.id) {
          this.txidMap.set(post.txid, post.id)
        }
        if (post.hash && post.hash !== post.id && post.hash !== post.txid) {
          this.txidMap.set(post.hash, post.id)
        }
      }
    },

    /**
     * Обновляет пост
     */
    updatePost(postId: string | number, updates: Partial<Post>): void {
      // Try to find by id directly first
      let id = postId

      if (!this.posts.has(id) && typeof id === 'string') {
        const mappedId = this.txidMap.get(id)
        if (mappedId !== undefined) {
          id = mappedId
        }
      }

      const post = this.posts.get(id)
      if (post) {
        this.posts.set(id, { ...post, ...updates })
      }
    },

    /**
     * Лайкает пост
     */
    likePost(postId: string | number): void {
      if (this.likedPosts.has(postId)) {
        // Убираем лайк
        this.likedPosts.delete(postId)
        const post = this.posts.get(postId)
        if (post && post.likes !== undefined) {
          post.likes = Math.max(0, post.likes - 1)
        }
      } else {
        // Добавляем лайк
        this.likedPosts.add(postId)
        const post = this.posts.get(postId)
        if (post) {
          post.likes = (post.likes || 0) + 1
        }
      }
    },

    /**
     * Комментирует пост
     */
    commentPost(postId: string | number): void {
      const post = this.posts.get(postId)
      if (post) {
        post.comments = (post.comments || 0) + 1
      }
    },

    /**
     * Делится постом
     */
    sharePost(postId: string | number): void {
      if (this.sharedPosts.has(postId)) {
        // Убираем шару
        this.sharedPosts.delete(postId)
        const post = this.posts.get(postId)
        if (post && post.shares !== undefined) {
          post.shares = Math.max(0, post.shares - 1)
        }
      } else {
        // Добавляем шару
        this.sharedPosts.add(postId)
        const post = this.posts.get(postId)
        if (post) {
          post.shares = (post.shares || 0) + 1
        }
      }
    },

    /**
     * Удаляет пост из store
     */
    removePost(postId: string | number): void {
      const post = this.posts.get(postId)
      if (post) {
        if (post.txid) this.txidMap.delete(post.txid)
        if (post.hash) this.txidMap.delete(post.hash)
      }
      this.posts.delete(postId)
      this.likedPosts.delete(postId)
      this.sharedPosts.delete(postId)
    },

    /**
     * Очищает все посты
     */
    clearPosts(): void {
      this.posts.clear()
      this.txidMap.clear()
      this.likedPosts.clear()
      this.sharedPosts.clear()
    }
  }
})
