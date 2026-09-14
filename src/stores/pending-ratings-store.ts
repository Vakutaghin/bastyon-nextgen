import { defineStore } from 'pinia'
import { postRatingPendingAPI } from '@/db/apis/post-rating-pending-api'
import { useAuthStore } from '@/stores'
import { usePostsStore } from '@/stores/posts-store'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCallArrayWithAuth } from '@/helpers/api/request'
import { calculateRatingUpdate } from '@/helpers/common/rating-calculator'
import type { GetPageScore } from '@/types/rpc-responses/get-page-scores'

type T_PendingItem = {
  shareId: string
  ratingValue: number
  expiresAt: number
  postTitle?: string
}

// Polling timer lives outside reactive state to avoid serialization/reactivity issues
let pollingTimer: ReturnType<typeof setInterval> | null = null

// Операции IDB по одному shareId выполняются строго по очереди (N10): `add`
// вызывается без await, и `markFailed`/`markSubmitted` раньше могли искать
// строку до того, как `add` её записал — строка оставалась 'pending' навсегда
// (фантомный pending после перезагрузки).
const ioChains = new Map<string, Promise<void>>()
function serialize(shareId: string, op: () => Promise<void>): Promise<void> {
  const prev = ioChains.get(shareId) ?? Promise.resolve()
  const next = prev.then(op, op).finally(() => {
    if (ioChains.get(shareId) === next) ioChains.delete(shareId)
  })
  ioChains.set(shareId, next)
  return next
}

export const usePendingRatingsStore = defineStore('pendingRatings', {
  state: () => ({
    items: new Map<string, T_PendingItem>(),
    isInitialized: false,
    /** Для какого адреса подняты items — смена аккаунта переинициализирует (X9). */
    initedForAddress: null as string | null,
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
    },
  },
  actions: {
    async init() {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!address) return
      if (this.isInitialized && this.initedForAddress === address) return

      this.isInitialized = true
      this.initedForAddress = address

      const active = await postRatingPendingAPI.getActiveByUser(address)
      // Пока ждали IDB, аккаунт сменился — этот ответ уже чужой.
      if (this.initedForAddress !== address) return
      this.items.clear()
      active.forEach((i) => {
        this.items.set(i.shareId, {
          shareId: i.shareId,
          ratingValue: i.ratingValue,
          expiresAt: i.expiresAt,
          postTitle: i.postTitle,
        })
      })
      await postRatingPendingAPI.cleanupExpired()
      this.ensurePolling()
    },
    async add(shareId: string, ratingValue: number, ttlMs: number, postTitle?: string) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!address) return
      this.items.set(shareId, { shareId, ratingValue, expiresAt: Date.now() + ttlMs, postTitle })
      this.ensurePolling()
      await serialize(shareId, async () => {
        await postRatingPendingAPI.addPending({
          shareId,
          userAddress: address,
          ratingValue,
          ttlMs,
          postTitle,
        })
      })
    },
    async markSubmitted(shareId: string, txid?: string) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!address) return
      await serialize(shareId, () =>
        postRatingPendingAPI.markSubmitted({ shareId, userAddress: address, txid })
      )
      this.ensurePolling()
    },
    async markConfirmed(shareId: string) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!address) return
      await serialize(shareId, () =>
        postRatingPendingAPI.markConfirmed({ shareId, userAddress: address })
      )
      this.items.delete(shareId)
      this.ensurePolling()
    },
    async markFailed(shareId: string, reason?: string) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!address) return
      await serialize(shareId, () =>
        postRatingPendingAPI.markFailed({ shareId, userAddress: address, reason })
      )
      this.items.delete(shareId)
      this.ensurePolling()
    },
    ensurePolling() {
      if (this.count === 0) {
        if (pollingTimer) {
          clearInterval(pollingTimer)
          pollingTimer = null
        }
        return
      }
      if (pollingTimer) return
      pollingTimer = setInterval(() => this.poll(), 5000)
    },
    /** Останавливает поллинг и забывает pending прежнего аккаунта (X9/V32). */
    reset() {
      if (pollingTimer) {
        clearInterval(pollingTimer)
        pollingTimer = null
      }
      this.items = new Map()
      this.isInitialized = false
      this.initedForAddress = null
    },
    async poll() {
      const auth = useAuthStore()
      const postsStore = usePostsStore()
      const address = auth.getUserAddress
      // Оценки подняты для другого адреса — не слать `getpagescores(postIds_A, B)`.
      if (!address || this.count === 0 || this.initedForAddress !== address) return
      const postIds = Array.from(this.items.keys())

      try {
        const arr = await rpcCallArrayWithAuth<GetPageScore>({
          method: rpcEndpoints.getPageScores,
          parameters: [postIds, address, []],
          options: { auth: false },
          // Add a unique cachehash to bypass cache
          cachehash: `${Date.now()}-${Math.random()}`,
        })

        arr.forEach((entry) => {
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
              const update = calculateRatingUpdate(
                post.myVal || 0,
                val,
                post.scoreSum || 0,
                post.scoreCnt || 0
              )

              // Delegate update to postsStore action (avoids direct state mutation)
              postsStore.updatePost(postId, update)
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
        console.warn('[PendingRatings] Polling error:', e)
      }
    },
  },
})
