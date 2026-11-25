// Что скачивать у поста: ролик или трек, а у аудиокниги — каждая запись.

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/user-names', () => ({
  userName: (_a: string, name?: string) => name ?? '',
  userAvatar: () => null,
}))

import { offlineSourcesFromPost } from './offline-source'

const part = (n: number) => `peertube://pt.example/u${n}/audio`
const post = {
  type: 'audio',
  txid: 'tx1',
  title: 'Книга',
  content: 'Описание',
  videoUrl: part(1),
  author: { address: 'PA', name: 'Автор' },
}

describe('offlineSourcesFromPost', () => {
  it('обычный трек — один', () => {
    expect(offlineSourcesFromPost(post)).toEqual([
      expect.objectContaining({ peertubeUrl: part(1), kind: 'audio', title: 'Книга' }),
    ])
  })

  it('аудиокнига — каждая запись со своим названием и длительностью', () => {
    const audios = [
      { url: part(1), title: 'Глава 1', duration: 60 },
      { url: part(2), title: '', duration: null },
    ]
    expect(offlineSourcesFromPost({ ...post, audios })).toEqual([
      expect.objectContaining({
        peertubeUrl: part(1),
        title: 'Глава 1',
        duration: 60,
        postId: 'tx1',
      }),
      expect.objectContaining({ peertubeUrl: part(2), title: 'Книга · 2', postId: 'tx1' }),
    ])
  })

  it('не ролик — нечего', () => {
    expect(offlineSourcesFromPost({ ...post, type: 'share' })).toEqual([])
  })
})
