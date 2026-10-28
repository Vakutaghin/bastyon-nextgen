// Сведения о роликах, вид поста для разделов, места в аудиокнигах, поиск аудио.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const net = vi.hoisted(() => ({
  appFetch: vi.fn(),
  rpcCallArray: vi.fn(),
  fetchHttp: vi.fn(),
  items: vi.fn(),
}))

vi.mock('@/helpers/api/request', () => ({
  appFetch: net.appFetch,
  rpcCallArray: net.rpcCallArray,
  fetchHttp: net.fetchHttp,
}))
vi.mock('@/services/collections/collections-api', () => ({ fetchCollectionItems: net.items }))
vi.mock('@/services/user-names', () => ({
  userName: (_a: string, known?: string) => known || 'adr',
}))

import { clearMediaInfoCache, fetchMediaInfo, thumbnailOf } from './media-info'
import { formatDuration, mediaTitle, mediaTypeOf, toQueueItem } from './media-post'
import { rememberPosition, savedPosition } from './audio-positions'
import { searchAudio } from './audio-search'
import type { AdaptedPost } from '@/types/adapted-post'

const URL_A = 'peertube://peertube372.pocketnet.app/d532cfb2-0108-49ba-9ce4-c8814cb7a1e2/audio'

beforeEach(() => {
  Object.values(net).forEach((f) => f.mockReset())
  clearMediaInfoCache()
  localStorage.clear()
})

describe('media-info', () => {
  it('превью: путь сервера ролика, выведенный сервер — его архив', () => {
    expect(thumbnailOf(URL_A, { thumbnailPath: '/static/thumbnails/x.jpg' })).toBe(
      'https://peertube372.pocketnet.app/static/thumbnails/x.jpg'
    )
    // 600 закрыт, его ролики держит 601 (helpers/api/peertube-archive.ts).
    expect(thumbnailOf('peertube://peertube600.pocketnet.app/u', { thumbnailPath: '/t.jpg' })).toBe(
      'https://peertube601.pocketnet.app/t.jpg'
    )
    expect(thumbnailOf(URL_A, {})).toBeNull()
  })

  it('одним запросом на пачку и из памяти при повторе', async () => {
    const fetchInfo = vi.fn(
      async ({ urls }: { urls: string[] }) =>
        new Map(urls.map((u) => [u, { duration: 129, views: 16, thumbnailPath: '/t.jpg' }]))
    )
    const first = await fetchMediaInfo([URL_A, URL_A, 'https://youtube.com/x'], fetchInfo)
    expect(first.get(URL_A)).toEqual({
      thumbnail: 'https://peertube372.pocketnet.app/t.jpg',
      duration: 129,
      views: 16,
    })
    await fetchMediaInfo([URL_A], fetchInfo)
    expect(fetchInfo).toHaveBeenCalledTimes(1)
  })
})

describe('media-post', () => {
  const post = (patch: Partial<AdaptedPost>): AdaptedPost =>
    ({
      id: 'a'.repeat(64),
      txid: 'a'.repeat(64),
      type: 'audio',
      videoUrl: URL_A,
      title: 'Enya',
      content: '',
      images: [],
      author: { name: 'Ann', address: 'P1' },
      ...patch,
    }) as unknown as AdaptedPost

  it('тип — только у роликов PeerTube', () => {
    expect(mediaTypeOf(post({}))).toBe('audio')
    expect(mediaTypeOf(post({ type: 'video', videoUrl: 'https://youtu.be/x' }))).toBeNull()
    expect(mediaTypeOf(post({ type: 'share' }))).toBeNull()
  })

  it('без заголовка — первая строка текста', () => {
    expect(mediaTitle(post({ title: '', content: '\n  Первая строка\nвторая' }))).toBe(
      'Первая строка'
    )
  })

  it('элемент очереди', () => {
    expect(toQueueItem(post({}), { thumbnail: 'https://t', duration: 10, views: 1 })).toMatchObject(
      {
        type: 'audio',
        url: URL_A,
        title: 'Enya',
        artist: 'Ann',
        cover: 'https://t',
        duration: 10,
      }
    )
  })

  it('длительность', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3723)).toBe('1:02:03')
    expect(formatDuration(0)).toBe('')
  })
})

describe('audio-positions', () => {
  it('запоминает место в длинной записи, забывает в конце, короткие — никогда', () => {
    rememberPosition('P1', 'x', 120, 3600)
    expect(savedPosition('P1', 'x')).toBe(120)
    expect(savedPosition('P2', 'x')).toBeNull()
    rememberPosition('P1', 'x', 3590, 3600)
    expect(savedPosition('P1', 'x')).toBeNull()
    rememberPosition('P1', 'y', 100, 200)
    expect(savedPosition('P1', 'y')).toBeNull()
  })
})

describe('audio-search', () => {
  it('ищет на серверах загрузки, посты — по точной ссылке с типом audio', async () => {
    net.fetchHttp.mockResolvedValue({ 0: 'peertube372.pocketnet.app', 1: 'dead.host' })
    net.appFetch.mockImplementation(async (url: string) =>
      url.includes('dead.host')
        ? { ok: false }
        : {
            ok: true,
            json: async () => ({ data: [{ uuid: 'd532cfb2-0108-49ba-9ce4-c8814cb7a1e2' }] }),
          }
    )
    net.rpcCallArray.mockResolvedValue([
      { txid: 't'.repeat(64) },
      { txid: 'd'.repeat(64), deleted: true },
    ])
    net.items.mockResolvedValue([{ txid: 't'.repeat(64), type: 'audio' }])
    const found = await searchAudio('Enya')
    expect(found).toHaveLength(1)
    expect(net.appFetch.mock.calls[0]![0]).toContain('search=Enya')
    expect(net.rpcCallArray.mock.calls[0]![0].parameters).toEqual([[URL_A], ['audio'], 0, 2])
    expect(net.items).toHaveBeenCalledWith(['t'.repeat(64)])
  })

  it('пустой запрос — без сети', async () => {
    expect(await searchAudio('  ')).toEqual([])
    expect(net.fetchHttp).not.toHaveBeenCalled()
  })
})
