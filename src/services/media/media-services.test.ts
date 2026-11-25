// Сведения о роликах, вид поста для разделов, вид ленты раздела, места в
// аудиокнигах, поиск аудио.

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
import { formatDuration, mediaTitle, mediaTypeOf, toQueueItem, toQueueItems } from './media-post'
import { rememberPart, rememberPosition, savedPart, savedPosition } from './audio-positions'
import { loadSectionView, saveSectionView, SECTION_VIEW_KEYS } from './media-section-view'
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

describe('media-section-view', () => {
  it('у каждого раздела свой вид; чужое значение — сетка', () => {
    expect(loadSectionView('video')).toBe('media')
    saveSectionView('video', 'posts')
    expect(loadSectionView('video')).toBe('posts')
    expect(loadSectionView('audio')).toBe('media')
    localStorage.setItem(SECTION_VIEW_KEYS.audio, 'table')
    expect(loadSectionView('audio')).toBe('media')
  })
})

describe('аудиокнига: несколько записей в посте', () => {
  const part = (n: number) => `peertube://pt.example/uuid-${n}/audio`
  const book = {
    txid: 'tx1',
    type: 'audio',
    title: 'Книга',
    videoUrl: part(1),
    author: { address: 'PA', name: 'Автор' },
    audios: [
      { url: part(1), title: 'Глава 1', duration: 60 },
      { url: part(2), title: '', duration: null },
    ],
  } as unknown as AdaptedPost

  it('в очередь встаёт каждая запись: свой id по uuid, пост общий', () => {
    expect(toQueueItems(book, { thumbnail: 'https://t/1.jpg', duration: 50, views: 1 })).toEqual([
      expect.objectContaining({
        id: 'tx1#uuid-1',
        postId: 'tx1',
        url: part(1),
        title: 'Глава 1',
        duration: 60,
        cover: 'https://t/1.jpg',
        artist: 'Автор',
      }),
      expect.objectContaining({
        id: 'tx1#uuid-2',
        postId: 'tx1',
        url: part(2),
        title: 'Книга · 2',
        duration: null,
      }),
    ])
  })

  it('обычный трек — один элемент с прежним id, не медиа — ни одного', () => {
    const track = { ...book, audios: undefined } as unknown as AdaptedPost
    expect(toQueueItems(track)).toEqual([toQueueItem(track)])
    expect(toQueueItems(track)[0]!.id).toBe('tx1')
    expect(toQueueItems({ ...track, type: 'share' } as AdaptedPost)).toEqual([])
  })

  it('где остановились в книге: своя запись у поста и человека; дослушали — забыли', () => {
    expect(savedPart('P1', 'tx1')).toBeNull()
    rememberPart('P1', 'tx1', 'tx1#uuid-2')
    expect(savedPart('P1', 'tx1')).toBe('tx1#uuid-2')
    expect(savedPart('P2', 'tx1')).toBeNull()
    expect(savedPart('P1', 'tx2')).toBeNull()
    // Место в самой записи — отдельно.
    rememberPosition('P1', 'tx1#uuid-2', 700, 3600)
    expect(savedPosition('P1', 'tx1#uuid-2')).toBe(700)
    expect(savedPart('P1', 'tx1')).toBe('tx1#uuid-2')
    rememberPart('P1', 'tx1', null)
    expect(savedPart('P1', 'tx1')).toBeNull()
  })

  it('мест не копится без конца', () => {
    for (let i = 0; i < 400; i++) rememberPart('P1', `tx${i}`, `tx${i}#u`, 1000 + i)
    expect(savedPart('P1', 'tx0')).toBeNull()
    expect(savedPart('P1', 'tx399')).toBe('tx399#u')
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
