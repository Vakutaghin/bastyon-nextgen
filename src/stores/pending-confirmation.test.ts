// S19: подтверждение из WS ловится по txid своей транзакции — в событии
// `type` лежит mesType уведомления (post/answer/…), а не тип операции.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePendingPostsStore } from './pending-posts-store'
import { useCommentsStore } from './comments-store'

beforeEach(() => setActivePinia(createPinia()))

describe('pending-posts-store (S19)', () => {
  it('knows which txid it is waiting for', () => {
    const store = usePendingPostsStore()
    store.addPending({
      id: 'TX1',
      address: 'PA',
      caption: 'c',
      message: 'm',
      images: [],
      tags: [],
      type: 'share',
    })

    expect(store.hasPendingTx('TX1')).toBe(true)
    expect(store.hasPendingTx('OTHER')).toBe(false)
    expect(store.hasPendingTx('')).toBe(false)

    store.applyConfirmedTx('TX1')
    expect(store.hasPendingTx('TX1')).toBe(false)
  })
})

describe('comments-store overrides (S19)', () => {
  it('clears the edit override by comment id, not by the edit txid', () => {
    const store = useCommentsStore()
    store.setEditedMessage('C1', 'новый текст')
    store.rememberTxForComment('EDIT_TX', 'C1')

    expect(store.hasPendingTx('P1', 'EDIT_TX')).toBe(true)

    store.applyConfirmedTx('P1', 'EDIT_TX', 'commentEdit')

    expect(store.editedMessages['C1']).toBeUndefined()
    expect(store.hasPendingTx('P1', 'EDIT_TX')).toBe(false)
  })

  it('clears the delete mark by comment id', () => {
    const store = useCommentsStore()
    store.markDeleted('C2')
    store.rememberTxForComment('DEL_TX', 'C2')

    store.applyConfirmedTx('P1', 'DEL_TX', 'commentDelete')

    expect(store.deletedCommentIds['C2']).toBeUndefined()
  })

  it('still finalises a pending comment by its own txid', () => {
    const store = useCommentsStore()
    store.addPending({
      id: 'TX2',
      postId: 'P1',
      message: 'hi',
      parentId: '',
      answerId: '',
      address: 'PA',
    })

    expect(store.hasPendingTx('P1', 'TX2')).toBe(true)
    store.applyConfirmedTx('P1', 'TX2')
    expect(store.hasPendingTx('P1', 'TX2')).toBe(false)
  })
})
