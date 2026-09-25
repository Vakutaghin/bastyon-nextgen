import { describe, it, expect } from 'vitest'
import { adaptPostData } from './post-mapper'

describe('adaptPostData', () => {
  const rawPost = {
    id: 'tx123',
    txid: 'tx123',
    hash: 'hash123',
    address: 'P123abc',
    userprofile: {
      name: 'Alice',
      i: 'avatar.jpg',
      reputation: 42,
      badges: ['verificated'],
      subscribers_count: 100,
      subscribes_count: 50,
    },
    c: 'Post Title',
    m: 'Post Content',
    time: 1700000000,
    scoreCnt: 10,
    scoreSum: 35,
    comments: 5,
    reposted: 2,
    t: ['tag1', 'tag2'],
    i: ['img1.jpg', 'img2.jpg'],
    type: 'video',
    u: 'peertube://host/videoid',
  }

  it('adapts post data correctly', () => {
    const result = adaptPostData(rawPost, 0)
    expect(result.id).toBe('tx123')
    expect(result.txid).toBe('tx123')
    expect(result.hash).toBe('hash123')
    expect(result.author.name).toBe('Alice')
    expect(result.author.address).toBe('P123abc')
    // голый хеш разворачивается в полный URL через resolveImageUrl
    expect(result.author.avatar).toBe('https://pocketnet.app:8092/i/avatar.jpg')
    expect(result.author.reputation).toBe(42)
    expect(result.author.letter).toBe('A')
    expect(result.author.verified).toBe(true)
    expect(result.title).toBe('Post Title')
    expect(result.content).toBe('Post Content')
    expect(result.likes).toBe(10)
    expect(result.comments).toBe(5)
    expect(result.shares).toBe(2)
    expect(result.tags).toEqual(['tag1', 'tag2'])
    expect(result.images).toEqual([
      'https://pocketnet.app:8092/i/img1.jpg',
      'https://pocketnet.app:8092/i/img2.jpg',
    ])
    expect(result.videoUrl).toBe('peertube://host/videoid')
    expect(result.type).toBe('video')
  })

  it('calculates ratingStars from scoreSum/scoreCnt', () => {
    const result = adaptPostData(rawPost, 0)
    expect(result.ratingStars).toBe(3.5) // 35/10 = 3.5
  })

  it('handles missing optional fields', () => {
    const minimal = { address: 'P000' }
    const result = adaptPostData(minimal, 7)
    expect(result.id).toBe(7) // fallback to index
    expect(result.author.name).toBe('P000')
    expect(result.title).toBe('')
    expect(result.content).toBe('')
    expect(result.tags).toEqual([])
    expect(result.images).toEqual([])
    expect(result.ratingStars).toBe(0)
  })

  it('falls back to "Неизвестный автор" if no name or address', () => {
    const result = adaptPostData({}, 0)
    expect(result.author.name).toBe('Неизвестный автор')
  })

  it('detects verified via flags.real', () => {
    const post = {
      userprofile: { name: 'Bob', flags: { real: 1 } },
    }
    const result = adaptPostData(post, 0)
    expect(result.author.verified).toBe(true)
  })

  it('decodes URL-encoded caption/message like the feed adapter (legacy trydecode)', () => {
    const result = adaptPostData(
      { c: '%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82', m: 'C%2B%2B%20tips' },
      0
    )
    expect(result.title).toBe('Привет')
    expect(result.content).toBe('C++ tips')
  })

  it('verified via flags.real even when badges is an empty array', () => {
    const result = adaptPostData(
      { userprofile: { name: 'Bob', badges: [], flags: { real: '1' } } },
      0
    )
    expect(result.author.verified).toBe(true)
  })
})
