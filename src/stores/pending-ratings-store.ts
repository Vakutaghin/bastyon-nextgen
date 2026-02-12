import { defineStore } from 'pinia'
import { postRatingPendingAPI } from '@/db'
import { useAuthStore } from '@/stores'
import { usePostsStore } from '@/stores/posts-store'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'


type T_PendingItem = {
  shareId: string
  ratingValue: number
  expiresAt: number
  postTitle?: string
}

export const usePendingRatingsStore = defineStore('pendingRatings', {
  state: () => ({
    items: new Map<string, T_PendingItem>(),
    pollingTimer: null as any,
    isInitialized: false
  }),
  getters: {
    count(): number {
      return this.items.size
    },
    hasPending(): (shareId: string) => boolean {
      return (shareId: string) => this.items.has(shareId)
    },
    getPendingValue(): (shareId: string) => number | null {
      return (shareId: string) => this.items.get(shareId)?.ratingValue ?? null
    },
    getPendingItem(): (shareId: string) => T_PendingItem | undefined {
      return (shareId: string) => this.items.get(shareId)
    }
  },
  actions: {
    async init() {
      if (this.isInitialized) return

      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!address) return

      this.isInitialized = true

      const active = await postRatingPendingAPI.getActiveByUser(address)
      this.items.clear()
      active.forEach((i) => {
        this.items.set(i.shareId, {
          shareId: i.shareId,
          ratingValue: i.ratingValue,
          expiresAt: i.expiresAt,
          postTitle: i.postTitle
        })
      })
      await postRatingPendingAPI.cleanupExpired()
      this.ensurePolling()
    },
    async add(shareId: string, ratingValue: number, ttlMs: number, postTitle?: string) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!address) return
      await postRatingPendingAPI.addPending({ shareId, userAddress: address, ratingValue, ttlMs, postTitle })
      this.items.set(shareId, { shareId, ratingValue, expiresAt: Date.now() + ttlMs, postTitle })
      this.ensurePolling()
    },
    async markSubmitted(shareId: string, txid?: string) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!address) return
      await postRatingPendingAPI.markSubmitted({ shareId, userAddress: address, txid })
      this.ensurePolling()
    },
    async markConfirmed(shareId: string) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!address) return
      await postRatingPendingAPI.markConfirmed({ shareId, userAddress: address })
      this.items.delete(shareId)
      this.ensurePolling()
    },
    async markFailed(shareId: string, reason?: string) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!address) return
      await postRatingPendingAPI.markFailed({ shareId, userAddress: address, reason })
      this.items.delete(shareId)
      this.ensurePolling()
    },
    ensurePolling() {
      if (this.count === 0) {
        if (this.pollingTimer) {
          clearInterval(this.pollingTimer)
          this.pollingTimer = null
        }
        return
      }
      if (this.pollingTimer) return
      this.pollingTimer = setInterval(() => this.poll(), 5000)
    },
    async poll() {
      const auth = useAuthStore()
      const postsStore = usePostsStore()
      const address = auth.getUserAddress
      if (!address || this.count === 0) return
      const postIds = Array.from(this.items.keys())

      try {
        const response = await getByPRCWithAuth({
          method: rpcEndpoints.getPageScores,
          parameters: [postIds, address, []],
          options: { auth: false },
          // Add a unique cachehash to bypass cache
          cachehash: `${Date.now()}-${Math.random()}`
        })

        const arr = Array.isArray((response as any)?.data) ? (response as any).data : (Array.isArray(response) ? response : [])

        arr.forEach((entry: any) => {
          const postId = entry.posttxid
          const val = Number(entry.value)

          // Check if postId matches and val is a valid number (including 0)
          if (postId && this.items.has(postId) && !isNaN(val)) {
            this.markConfirmed(postId)

            // Update posts store
            // Try to find post by txid (which is what we have as postId)
            // Use updatePost which now handles txid lookup internally via txidMap
            const post = postsStore.getPostByShareId(postId)

            if (post) {
              const oldMyVal = post.myVal || 0
              const newMyVal = val
              let newScoreSum = (post.scoreSum || 0)
              let newScoreCnt = (post.scoreCnt || 0)

              if (oldMyVal === 0) {
                newScoreCnt += 1
                newScoreSum += newMyVal
              } else {
                newScoreSum = newScoreSum - oldMyVal + newMyVal
              }

              // Pass postId (txid) - updatePost will resolve it to ID if needed
              postsStore.updatePost(postId, {
                myVal: newMyVal,
                scoreSum: newScoreSum,
                scoreCnt: newScoreCnt
              })
            } else {
              console.warn('[PendingRatings] Post not found in store for update:', postId)
            }
          }
        })

        await postRatingPendingAPI.cleanupExpired()
        const now = Date.now()

        Array.from(this.items.values()).forEach((i) => {
          if (i.expiresAt <= now) {
            this.items.delete(i.shareId)
          }
        })

        this.ensurePolling()
      } catch (e) {
        // ignore polling errors
      }
    }
  }
})
