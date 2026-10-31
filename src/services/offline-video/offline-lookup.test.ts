// Плеер, фоновый звук, обложка и субтитры берут скачанную копию — без
// запроса к ноде, и при живой сети тоже.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { OfflineBackend, OfflineItem } from './types'

const h = vi.hoisted(() => ({
  backend: null as Partial<OfflineBackend> | null,
  info: vi.fn(),
}))

vi.mock('@/services/offline-video/backend', () => ({ offlineBackend: async () => h.backend }))
vi.mock('@/helpers/api/peertube-api', async (orig) => ({
  ...(await orig<typeof import('@/helpers/api/peertube-api')>()),
  getPeerTubeVideoInfo: h.info,
}))

import { getVideoSourcesFromUrl, getVideoThumbnailFromUrl } from '@/helpers/api/peertube-url'
import {
  knownLocalCopy,
  nativeUrlForPageUrl,
  offlineCaptions,
  rememberOfflineItem,
  rememberOfflineItems,
  resetOfflineLookup,
} from './offline-lookup'

const URL1 = 'peertube://peertube701.pocketnet.app/AbC-1'

function item(status: OfflineItem['state']['status'] = 'done'): OfflineItem {
  return {
    id: 'abc-1-144',
    meta: {
      id: 'abc-1-144',
      peertubeUrl: URL1,
      kind: 'video',
      uuid: 'uuid-1',
      title: 't',
      author: { address: 'P' },
      thumb: true,
      height: 144,
      size: 1,
      createdAt: 1,
      accounts: ['P'],
      captions: [{ language: 'ru', label: 'Русский', file: 'captions/ru.vtt' }],
    },
    state: { status, received: 1, total: 1 },
  }
}

describe('offline-lookup', () => {
  beforeEach(() => {
    resetOfflineLookup()
    h.info.mockReset().mockResolvedValue({
      uuid: 'uuid-1',
      streamingPlaylists: [{ id: 1, playlistUrl: 'https://n/master.m3u8', files: [] }],
      thumbnailPath: '/t.jpg',
    })
    h.backend = {
      list: vi.fn(async () => [item()]),
      fileUrl: vi.fn(async (id: string, file: string) => `local://${id}/${file}`),
      nativeUrl: vi.fn(async (id: string) => `file:///data/offline/${id}/video.mp4`),
    }
  })

  it('скачанный ролик играет с диска, нода не спрашивается', async () => {
    const sources = await getVideoSourcesFromUrl(URL1)
    expect(sources).toEqual({
      hlsPlaylistUrl: null,
      progressiveUrl: 'local://abc-1-144/video.mp4',
      nativeUrl: 'file:///data/offline/abc-1-144/video.mp4',
    })
    expect(h.info).not.toHaveBeenCalled()
    expect(await getVideoThumbnailFromUrl(URL1)).toBe('local://abc-1-144/thumb.jpg')
  })

  it('по id ролика: копия из архива и ссылка с другой нодой — один ролик', async () => {
    rememberOfflineItems([item()])
    expect(knownLocalCopy('peertube://peertube601.pocketnet.app/abc-1')?.id).toBe('abc-1-144')
    expect(knownLocalCopy('peertube://h/uuid-1')?.id).toBe('abc-1-144')
  })

  it('недокачанное — не копия: играет сеть', async () => {
    rememberOfflineItems([item('downloading')])
    const sources = await getVideoSourcesFromUrl(URL1)
    expect(sources.hlsPlaylistUrl).toBe('https://n/master.m3u8')
    expect(h.info).toHaveBeenCalled()
  })

  it('удалённая копия забывается', async () => {
    rememberOfflineItems([item()])
    rememberOfflineItem('abc-1-144', null)
    expect(knownLocalCopy(URL1)).toBeNull()
  })

  it('субтитры копии — из её папки; нет копии — null', async () => {
    expect(await offlineCaptions(URL1)).toEqual([
      { language: 'ru', label: 'Русский', url: 'local://abc-1-144/captions/ru.vtt' },
    ])
    expect(await offlineCaptions('peertube://h/other')).toBeNull()
  })

  it('без бэкенда — как раньше, с ноды', async () => {
    h.backend = null
    const sources = await getVideoSourcesFromUrl(URL1)
    expect(sources.hlsPlaylistUrl).toBe('https://n/master.m3u8')
  })
})

describe('offline-lookup: ExoPlayer', () => {
  beforeEach(() => {
    resetOfflineLookup()
    h.backend = {
      list: vi.fn(async () => [item()]),
      fileUrl: vi.fn(
        async (id: string, file: string) => `https://localhost/_offline_/${id}/${file}`
      ),
      nativeUrl: vi.fn(async () => 'file:///data/offline/abc-1-144/playlist.m3u8'),
    }
  })

  it('адрес перехвата WebView — в файл с диска; без нативного адреса — никуда', async () => {
    const page = 'https://localhost/_offline_/abc-1-144/video.mp4'
    expect(nativeUrlForPageUrl(page)).toBeNull()
    await getVideoSourcesFromUrl(URL1)
    expect(nativeUrlForPageUrl(page)).toBe('file:///data/offline/abc-1-144/playlist.m3u8')
    expect(nativeUrlForPageUrl('https://n/master.m3u8')).toBeUndefined()
  })
})
