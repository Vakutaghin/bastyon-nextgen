import { describe, it, expect } from 'vitest'
import { adaptPostData, extractRawPosts } from './post-mapper'

describe('extractRawPosts', () => {
  it('returns [] for falsy input', () => {
    expect(extractRawPosts(null)).toEqual([])
    expect(extractRawPosts(undefined)).toEqual([])
  })

  it('returns array as-is', () => {
    const posts = [{ id: 1 }, { id: 2 }]
    expect(extractRawPosts(posts)).toBe(posts)
  })

  it('extracts from data.contents', () => {
    const contents = [{ id: 1 }]
    expect(extractRawPosts({ data: { contents } })).toBe(contents)
  })

  it('extracts from data[]', () => {
    const data = [{ id: 1 }]
    expect(extractRawPosts({ data })).toBe(data)
  })

  it('extracts from result[]', () => {
    const result = [{ id: 1 }]
    expect(extractRawPosts({ result })).toBe(result)
  })

  it('extracts from posts[]', () => {
    const posts = [{ id: 1 }]
    expect(extractRawPosts({ posts })).toBe(posts)
  })

  it('extracts from contents[]', () => {
    const contents = [{ id: 1 }]
    expect(extractRawPosts({ contents })).toBe(contents)
  })

  it('returns [] for unknown shape', () => {
    expect(extractRawPosts({ foo: 'bar' })).toEqual([])
  })
})

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
})
