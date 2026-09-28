import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { PENDING_VOTE_TTL_MS, usePollVotesStore } from './poll-votes-store'

describe('poll-votes-store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useRealTimers()
  })

  it('неподтверждённый голос свой у каждого аккаунта и переживает перезагрузку', () => {
    usePollVotesStore().addPending('alice', 'post1', 2, 'tx1')
    setActivePinia(createPinia())
    const store = usePollVotesStore()
    expect(store.pendingFor('alice', 'post1')).toMatchObject({ vote: 2, txid: 'tx1' })
    expect(store.pendingFor('bob', 'post1')).toBeNull()
    store.removePending('alice', 'post1')
    expect(store.pendingFor('alice', 'post1')).toBeNull()
  })

  it('через 30 минут без подтверждения голос забывается — можно голосовать снова', () => {
    vi.useFakeTimers()
    const store = usePollVotesStore()
    store.addPending('alice', 'post1', 0, 'tx1')
    vi.advanceTimersByTime(PENDING_VOTE_TTL_MS + 1)
    expect(store.pendingFor('alice', 'post1')).toBeNull()
    vi.useRealTimers()
  })

  it('испорченное хранилище не ломает опросы', () => {
    localStorage.setItem('bastyon_poll_votes_pending', '{"x":{"vote":"a"}}')
    expect(usePollVotesStore().pending).toEqual({})
  })

  it('число голосов-комментариев под постом', () => {
    const store = usePollVotesStore()
    expect(store.voteCommentsFor('post1')).toBe(0)
    store.setVoteComments('post1', 3)
    expect(store.voteCommentsFor('post1')).toBe(3)
  })
})
