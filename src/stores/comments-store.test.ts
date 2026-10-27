// Свой новый комментарий ждёт блока: в блоке — часы снимаются, а сам он виден,
// пока список комментариев его не отдаст (открытый список перезагружается);
// не попал в блок — пометка «Ошибка», а не тихое исчезновение через 10 минут.

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { notifyTransactionSettled } from '@/blockchain/core/transactions/broadcast-events'
import { pendingToGetComment } from '@/b-components/content/post-card/components/post-card-comments/helpers/pending-comments'
import { PENDING_COMMENT_TTL_MS, useCommentsStore, type PendingComment } from './comments-store'

const comment = (id: string, over: Partial<PendingComment> = {}): PendingComment => ({
  id,
  postId: 'P1',
  message: 'привет',
  parentId: '',
  answerId: '',
  address: 'PMe',
  createdAt: 1000,
  expiresAt: 1000 + PENDING_COMMENT_TTL_MS,
  ...over,
})

beforeEach(() => setActivePinia(createPinia()))

describe('comments-store: свой новый комментарий и блок', () => {
  it('в блоке: из часов уходит, в списке остаётся без часов, список перезагружается', () => {
    const store = useCommentsStore()
    store.init()
    store.addPending(comment('TX1'))
    expect(store.pendingCount).toBe(1)

    notifyTransactionSettled('TX1', true)
    expect(store.pendingCount).toBe(0)
    expect(store.allPending).toHaveLength(0)
    expect(store.confirmedTick['P1']).toBe(1)
    const [kept] = store.getPendingForPost('P1')
    expect(pendingToGetComment(kept!).temp).toBe(false)

    store.reconcileWithServer('P1', [{ id: 'TX1' } as never])
    expect(store.getPendingForPost('P1')).toHaveLength(0)
  })

  it('не попал в блок — «Ошибка», а не пропажа', () => {
    const store = useCommentsStore()
    store.init()
    store.addPending(comment('TX2'))
    notifyTransactionSettled('TX2', false)
    const [failed] = store.getPendingForPost('P1')
    expect(failed!.failed).toBe(true)
    expect(pendingToGetComment(failed!)).toMatchObject({ temp: false, rejected: true })
    expect(store.pendingCount).toBe(0)
  })

  it('срок вышел без ответа трекера — тоже «Ошибка»; подтверждённый уходит через 10 минут', () => {
    const store = useCommentsStore()
    store.addPending(comment('old', { expiresAt: 500 }))
    store.addPending(comment('ok'))
    store.markCreateConfirmed('ok')
    const at = store.getPendingForPost('P1').find((c) => c.id === 'ok')!.confirmedAt!
    store.cleanupExpired(1000)
    expect(store.getPendingForPost('P1').map((c) => [c.id, !!c.failed])).toEqual([
      ['old', true],
      ['ok', false],
    ])
    store.cleanupExpired(at + 10 * 60 * 1000 + 1)
    expect(store.getPendingForPost('P1').map((c) => c.id)).toEqual(['old'])
  })
})
