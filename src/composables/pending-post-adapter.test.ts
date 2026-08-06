import { describe, it, expect } from 'vitest'
import { pendingPostToAdapted, isPostOpType, POST_OP_TYPES } from './pending-post-adapter'
import type { PendingPost } from '@/stores/pending-posts-store'

const author = { name: 'Me', address: 'PAddr', avatar: null, reputation: 5, letter: 'M' }

const pending: PendingPost = {
  id: 'txid-1',
  address: 'PAddr',
  caption: 'Hello',
  message: 'World',
  images: ['https://cdn/x.jpg'],
  tags: ['news'],
  url: 'peertube://h/uuid',
  type: 'video',
  createdAt: 1_700_000_000_000,
  expiresAt: 1_700_000_600_000,
}

describe('isPostOpType', () => {
  it('распознаёт типы постов и отсекает прочее', () => {
    for (const t of POST_OP_TYPES) expect(isPostOpType(t)).toBe(true)
    expect(isPostOpType('comment')).toBe(false)
    expect(isPostOpType('cScore')).toBe(false)
    expect(isPostOpType(undefined)).toBe(false)
    expect(isPostOpType('')).toBe(false)
  })
})

describe('pendingPostToAdapted', () => {
  it('разворачивает pending в AdaptedPost с флагом pending и переносит поля', () => {
    const a = pendingPostToAdapted(pending, author)
    expect(a.pending).toBe(true)
    expect(a.id).toBe('txid-1')
    expect(a.txid).toBe('txid-1')
    expect(a.title).toBe('Hello')
    expect(a.content).toBe('World')
    expect(a.images).toEqual(['https://cdn/x.jpg'])
    expect(a.tags).toEqual(['news'])
    expect(a.type).toBe('video')
    expect(a.videoUrl).toBe('peertube://h/uuid')
    expect(a.author).toEqual(author)
    // ISO-строка из createdAt
    expect(a.timestamp).toBe(new Date(pending.createdAt).toISOString())
    // Нулевые метрики — по неопубликованному нельзя голосовать/комментить
    expect(a.likes).toBe(0)
    expect(a.comments).toBe(0)
    expect(a.scoreCnt).toBe(0)
  })
})
