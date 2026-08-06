import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePendingPostsStore, type PendingPost } from './pending-posts-store'

const make = (over: Partial<PendingPost> = {}): PendingPost => ({
  id: over.id ?? 'txid-1',
  address: over.address ?? 'PAddr',
  caption: over.caption ?? 'Title',
  message: over.message ?? 'Body',
  images: over.images ?? [],
  tags: over.tags ?? [],
  url: over.url,
  type: over.type ?? 'share',
  createdAt: over.createdAt ?? 1000,
  expiresAt: over.expiresAt ?? 1000 + 600000,
})

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('usePendingPostsStore', () => {
  it('addPending кладёт пост под адресом и считается в count/allPending', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'a', address: 'PAddr' }))
    expect(s.getPendingForAddress('PAddr')).toHaveLength(1)
    expect(s.pendingCount).toBe(1)
    expect(s.allPending.map((p) => p.id)).toEqual(['a'])
  })

  it('addPending дедуплицирует по id', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'a', caption: 'v1' }))
    s.addPending(make({ id: 'a', caption: 'v2' }))
    const list = s.getPendingForAddress('PAddr')
    expect(list).toHaveLength(1)
    expect(list[0]!.caption).toBe('v2')
  })

  it('getPendingForAddress сортирует свежие сверху (desc по createdAt)', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'old', createdAt: 100 }))
    s.addPending(make({ id: 'new', createdAt: 500 }))
    expect(s.getPendingForAddress('PAddr').map((p) => p.id)).toEqual(['new', 'old'])
  })

  it('removePending снимает конкретный пост и чистит пустой адрес', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'a' }))
    s.removePending('PAddr', 'a')
    expect(s.getPendingForAddress('PAddr')).toHaveLength(0)
    expect(s.pendingCount).toBe(0)
  })

  it('reconcileWithServer снимает pending, чей txid уже в ленте', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'seen', address: 'PAddr' }))
    s.addPending(make({ id: 'unseen', address: 'PAddr' }))
    s.reconcileWithServer('PAddr', new Set(['seen', 'other']))
    expect(s.getPendingForAddress('PAddr').map((p) => p.id)).toEqual(['unseen'])
  })

  it('applyConfirmedTx снимает pending по txid независимо от адреса', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'x', address: 'PAddr' }))
    s.applyConfirmedTx('x')
    expect(s.pendingCount).toBe(0)
  })

  it('applyConfirmedTx игнорирует пустой txid и неизвестный id', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'x' }))
    s.applyConfirmedTx('')
    s.applyConfirmedTx('nope')
    expect(s.pendingCount).toBe(1)
  })

  it('cleanupExpired удаляет только просроченные', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'live', expiresAt: 2000 }))
    s.addPending(make({ id: 'dead', expiresAt: 500 }))
    s.cleanupExpired(1000)
    expect(s.getPendingForAddress('PAddr').map((p) => p.id)).toEqual(['live'])
  })

  it('reset очищает всё', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'a', address: 'A' }))
    s.addPending(make({ id: 'b', address: 'B' }))
    s.reset()
    expect(s.pendingCount).toBe(0)
    expect(s.allPending).toHaveLength(0)
  })
})
