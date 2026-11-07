import { describe, it, expect, vi } from 'vitest'
import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { createVideoMethods, legacyVideoItem } from './videos'

const URL_A = 'peertube://peertube372.pocketnet.app/d532cfb2-0108-49ba-9ce4-c8814cb7a1e2'
const URL_B = 'peertube://peertube101.pocketnet.app/e8f1d448-9807-4b05-99da-06496092fc53'

/** Ответ ноды `peertube/videos` (сокращён) — с mainnet. */
const RAW_A = {
  uuid: 'd532cfb2-0108-49ba-9ce4-c8814cb7a1e2',
  name: 'Ролик',
  state: { id: 1, label: 'Published' },
  thumbnailPath: '/static/thumbnails/86ea29bc.jpg',
  previewPath: '/lazy-static/previews/86ea29bc.jpg',
  duration: 61,
  views: 5,
  viewers: 0,
  aspectRatio: 1.7778,
  isLive: false,
  createdAt: '2024-03-01T10:00:00.000Z',
  streamingPlaylists: [
    {
      playlistUrl:
        'https://peertube372.pocketnet.app/static/streaming-playlists/hls/d532cfb2/master.m3u8',
    },
  ],
  from: 'peertube372.pocketnet.app',
}

const mediaUrl = (url: string, path: string | undefined) => {
  const host = parsePeerTubeUrl(url)?.host
  return path && host ? `https://${host}${path}` : null
}

describe('legacyVideoItem', () => {
  it('форма прежнего клиента: Barteron читает состояние, плейлист и обложку', () => {
    const item = legacyVideoItem(URL_A, RAW_A, { parsePointer: parsePeerTubeUrl, mediaUrl })!
    expect(item.link).toBe(URL_A)
    expect(item.meta).toEqual({
      type: 'peertube',
      id: 'd532cfb2-0108-49ba-9ce4-c8814cb7a1e2',
      host_name: 'peertube372.pocketnet.app',
    })
    expect(item.data).toMatchObject({
      thumbnail: 'https://peertube372.pocketnet.app/static/thumbnails/86ea29bc.jpg',
      image: 'https://peertube372.pocketnet.app/lazy-static/previews/86ea29bc.jpg',
      duration: 61,
      views: 5,
      aspectRatio: 1.7778,
      isLive: false,
      isCorrect: true,
    })
    const original = item.data.original as typeof RAW_A
    expect(original.state.id).toBe(1)
    expect(original.streamingPlaylists[0]!.playlistUrl).toMatch(/master\.m3u8$/)
  })

  it('старые ролики и эфиры — 16:9, как у прежнего клиента', () => {
    const deps = { parsePointer: parsePeerTubeUrl, mediaUrl }
    const old = legacyVideoItem(URL_A, { ...RAW_A, createdAt: '2020-01-01T00:00:00Z' }, deps)!
    const live = legacyVideoItem(URL_A, { ...RAW_A, isLive: true }, deps)!
    expect(old.data.aspectRatio).toBe(1.78)
    expect(live.data.aspectRatio).toBe(1.78)
  })
})

describe('createVideoMethods.getVideosInfo', () => {
  const make = (known: Record<string, Record<string, unknown>>) => {
    const fetchInfo = vi.fn(
      async (urls: string[]) => new Map(urls.filter((u) => known[u]).map((u) => [u, known[u]!]))
    )
    const methods = createVideoMethods({
      fetchInfo,
      parsePointer: parsePeerTubeUrl,
      mediaUrl,
      openDialog: vi.fn(async () => null),
    })
    return { fetchInfo, methods }
  }

  it('порядок ссылок сохраняется; неизвестное ноде и не PeerTube — null', async () => {
    const { fetchInfo, methods } = make({ [URL_A]: RAW_A })
    const out = await methods.getVideosInfo([URL_B, 'https://youtu.be/x', URL_A], true)
    expect(out.map((i) => i?.link ?? null)).toEqual([null, null, URL_A])
    // Ноду спрашиваем только о роликах PeerTube, с флагом update.
    expect(fetchInfo).toHaveBeenCalledWith([URL_B, URL_A], true)
  })

  it('много ссылок — пачками по 40', async () => {
    const urls = Array.from(
      { length: 85 },
      (_, i) => `peertube://h.test/00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
    )
    const { fetchInfo, methods } = make({})
    await methods.getVideosInfo(urls, false)
    expect(fetchInfo.mock.calls.map(([batch]) => batch.length)).toEqual([40, 40, 5])
  })
})
