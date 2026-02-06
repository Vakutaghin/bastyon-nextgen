import { db } from '../database'
import type { PendingPostRating } from '../types'

function now() {
  return Date.now()
}

export const postRatingPendingAPI = {
  async addPending(params: { shareId: string; userAddress: string; ratingValue: number; ttlMs: number; postTitle?: string }) {
    const item: PendingPostRating = {
      shareId: params.shareId,
      userAddress: params.userAddress,
      ratingValue: params.ratingValue,
      status: 'pending',
      expiresAt: now() + params.ttlMs,
      createdAt: now(),
      updatedAt: now(),
      postTitle: params.postTitle
    }
    const id = await db.postRatingsPending.add(item)
    return { ...item, id }
  },

  async markSubmitted(params: { shareId: string; userAddress: string; txid?: string }) {
    const existing = await db.postRatingsPending
      .where({ shareId: params.shareId, userAddress: params.userAddress })
      .first()
    if (!existing) return
    await db.postRatingsPending.update(existing.id!, {
      status: 'submitted',
      txid: params.txid,
      updatedAt: now()
    })
  },

  async markConfirmed(params: { shareId: string; userAddress: string }) {
    const existing = await db.postRatingsPending
      .where({ shareId: params.shareId, userAddress: params.userAddress })
      .first()
    if (!existing) return
    await db.postRatingsPending.delete(existing.id!)
  },

  async markFailed(params: { shareId: string; userAddress: string; reason?: string }) {
    const existing = await db.postRatingsPending
      .where({ shareId: params.shareId, userAddress: params.userAddress })
      .first()
    if (!existing) return
    await db.postRatingsPending.update(existing.id!, {
      status: 'failed',
      lastError: params.reason,
      updatedAt: now()
    })
  },

  async getActiveByUser(userAddress: string) {
    const items = await db.postRatingsPending
      .where('userAddress')
      .equals(userAddress)
      .toArray()
    const time = now()
    return items.filter((i) => i.expiresAt > time && (i.status === 'pending' || i.status === 'submitted'))
  },

  async cleanupExpired() {
    const time = now()
    const items = await db.postRatingsPending.where('expiresAt').belowOrEqual(time).toArray()
    const ids = items.map((i) => i.id!).filter(Boolean)
    if (ids.length) {
      await db.postRatingsPending.bulkDelete(ids)
    }
    return ids.length
  }
}
