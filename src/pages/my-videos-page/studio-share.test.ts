import { describe, expect, it } from 'vitest'

import { chatLinks, publicPostUrl } from '@/helpers/common/share-origin'
import { videoShareLink } from './studio-share'

const POINTER = 'peertube://peertube701.pocketnet.app/5f1c2d3e-0000-4000-8000-000000000001/audio'

describe('videoShareLink', () => {
  it('with posts: the freshest post', () => {
    const link = videoShareLink({
      pointer: POINTER,
      processing: false,
      posts: [
        { txid: 'fresh', caption: '', time: 2 },
        { txid: 'old', caption: '', time: 1 },
      ],
    })
    expect(link).toEqual({
      url: publicPostUrl('fresh'),
      chatUrl: chatLinks.post('fresh'),
      kind: 'post',
    })
    // В чат — всегда формат bastyon.com: там ссылка становится карточкой поста.
    expect(link?.chatUrl).toBe('https://bastyon.com/post?s=fresh')
  })

  it('without a post: the video page on the server, audio too', () => {
    expect(videoShareLink({ pointer: POINTER, processing: false, posts: [] })).toEqual({
      url: 'https://peertube701.pocketnet.app/videos/watch/5f1c2d3e-0000-4000-8000-000000000001',
      chatUrl:
        'https://peertube701.pocketnet.app/videos/watch/5f1c2d3e-0000-4000-8000-000000000001',
      kind: 'server',
    })
  })

  it('still processing and no post: nothing to share yet', () => {
    expect(videoShareLink({ pointer: POINTER, processing: true, posts: [] })).toBeNull()
  })

  it('a post is shareable while the video is processing', () => {
    const link = videoShareLink({
      pointer: POINTER,
      processing: true,
      posts: [{ txid: 'tx', caption: '', time: 1 }],
    })
    expect(link?.kind).toBe('post')
  })

  it('a broken pointer gives no link', () => {
    expect(videoShareLink({ pointer: 'nonsense', processing: false, posts: [] })).toBeNull()
  })
})
