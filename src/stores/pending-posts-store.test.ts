import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  CONFIRMED_KEEP_MS,
  PENDING_POST_TTL_MS,
  pendingPostDeadline,
  usePendingPostsStore,
  type PendingPost,
} from './pending-posts-store'
import { notifyTransactionSettled } from '@/blockchain/core/transactions/broadcast-events'

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
  localStorage.clear()
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

  it('просроченный ожидающий — не попал в блок: остаётся с пометкой, из часов уходит', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'live', expiresAt: 2000 }))
    s.addPending(make({ id: 'dead', expiresAt: 500 }))
    s.cleanupExpired(1000)
    expect(s.getPendingForAddress('PAddr').map((p) => [p.id, !!p.failed])).toEqual([
      ['live', false],
      ['dead', true],
    ])
    expect(s.allPending.map((p) => p.id)).toEqual(['live'])
    expect(s.pendingCount).toBe(1)
  })

  it('в блоке: пометка снята, пост в ленте профиля, пока лента его не отдаст', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'tx' }))
    s.applyConfirmedTx('tx')
    expect(s.getPendingForAddress('PAddr')[0]!.confirmedAt).toBeGreaterThan(0)
    expect(s.pendingCount).toBe(0)
    expect(s.hasPendingTx('tx')).toBe(false)
    s.reconcileWithServer('PAddr', new Set(['tx']))
    expect(s.getPendingForAddress('PAddr')).toHaveLength(0)
  })

  it('подтверждённый, которого лента так и не отдала, уходит через 10 минут', () => {
    const s = usePendingPostsStore()
    s.addPending(make({ id: 'tx', expiresAt: Number.MAX_SAFE_INTEGER }))
    s.applyConfirmedTx('tx')
    const at = s.getPendingForAddress('PAddr')[0]!.confirmedAt!
    s.cleanupExpired(at + CONFIRMED_KEEP_MS - 1)
    expect(s.getPendingForAddress('PAddr')).toHaveLength(1)
    s.cleanupExpired(at + CONFIRMED_KEEP_MS + 1)
    expect(s.getPendingForAddress('PAddr')).toHaveLength(0)
  })

  it('исход транзакции приходит от общего трекера', () => {
    const s = usePendingPostsStore()
    s.init(null)
    s.addPending(make({ id: 'ok' }))
    s.addPending(make({ id: 'lost' }))
    notifyTransactionSettled('ok', true)
    notifyTransactionSettled('lost', false)
    const byId = new Map(s.getPendingForAddress('PAddr').map((p) => [p.id, p]))
    expect(byId.get('ok')!.confirmedAt).toBeGreaterThan(0)
    expect(byId.get('lost')!.failed).toBe(true)
    // Подтверждённый не становится «не попавшим» и наоборот.
    notifyTransactionSettled('ok', false)
    expect(s.findTx('ok')!.failed).toBeFalsy()
    s.dismiss('lost')
    expect(s.findTx('lost')).toBeUndefined()
  })

  it('ожидание переживает перезапуск: записи аккаунта в localStorage', () => {
    const s = usePendingPostsStore()
    s.addPending(
      make({
        id: 'saved',
        address: 'PMe',
        images: ['data:image/png;base64,AAA', 'https://img/1.jpg'],
      })
    )
    setActivePinia(createPinia())
    const again = usePendingPostsStore()
    expect(again.getPendingForAddress('PMe')).toHaveLength(0)
    again.init('PMe')
    const [restored] = again.getPendingForAddress('PMe')
    expect(restored!.id).toBe('saved')
    // base64 в хранилище не кладём — только загруженные картинки.
    expect(restored!.images).toEqual(['https://img/1.jpg'])
    again.removePending('PMe', 'saved')
    expect(localStorage.getItem('BST_PENDING_POSTS_PMe')).toBeNull()
  })

  it('срок отложенного поста — от его времени', () => {
    expect(pendingPostDeadline(1000, 5000)).toBe(5000 + PENDING_POST_TTL_MS)
    expect(pendingPostDeadline(1000)).toBe(1000 + PENDING_POST_TTL_MS)
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
