// Задание на скачивание: какие качества, откуда качать, что положить рядом.

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/offline-video/backend', () => ({ offlineBackend: async () => null }))

import type { PeerTubeVideoInfo } from '@/helpers/api/peertube-url'
import {
  absolutePeerTubeUrl,
  buildOfflineJob,
  fileSources,
  isProcessing,
  offlineId,
  offlineQualities,
  pickQuality,
  type OfflineSource,
} from './offline-job'

const UUID = '238e3bd3-e707-4cb1-acb2-06b8594b71a5'
const BASE = `https://peertube701.pocketnet.app/static/streaming-playlists/hls/${UUID}`

/** Как отвечает живая нода (сверено 31.10.2026). */
function info(over: Partial<PeerTubeVideoInfo> = {}): PeerTubeVideoInfo {
  return {
    id: 1,
    uuid: UUID,
    name: 'Ролик',
    duration: 104,
    state: { id: 1, label: 'Published' },
    thumbnailPath: '/static/thumbnails/85971e91.jpg',
    servedBy: 'peertube701.pocketnet.app',
    streamingPlaylists: [
      {
        id: 7,
        playlistUrl: `${BASE}/master.m3u8`,
        segmentsSha256Url: `${BASE}/4e7e-segments-sha256.json`,
        files: [
          {
            resolution: { id: 360, label: '360p' },
            size: 6951739,
            fileUrl: `${BASE}/2611-360-fragmented.mp4`,
          },
          {
            resolution: { id: 144, label: '144p' },
            size: 2918128,
            fileUrl: `${BASE}/7f87-144-fragmented.mp4`,
          },
        ],
      },
    ],
    files: [],
    ...over,
  }
}

const source: OfflineSource = {
  peertubeUrl: `peertube://peertube701.pocketnet.app/${UUID}`,
  kind: 'video',
  postId: 'a'.repeat(64),
  title: 'Заголовок поста',
  description: 'Текст 0:30 глава',
  author: { address: 'PAddr', name: 'Автор', avatarUrl: 'https://img.example/a.jpg' },
}

describe('offline-job', () => {
  it('качества по возрастанию, с суммами фрагментов у HLS', () => {
    const qs = offlineQualities(info())
    expect(qs.map((q) => q.height)).toEqual([144, 360])
    expect(qs[0]).toMatchObject({ size: 2918128, sha256Url: `${BASE}/4e7e-segments-sha256.json` })
  })

  it('старый ролик без HLS — прямые файлы, без сумм', () => {
    const qs = offlineQualities(
      info({
        streamingPlaylists: [],
        files: [
          { resolution: { id: 480, label: '480p' }, size: 10, fileUrl: 'https://h/v-480.mp4' },
        ],
      })
    )
    expect(qs).toEqual([{ height: 480, size: 10, fileUrl: 'https://h/v-480.mp4' }])
  })

  it('ролик в обработке скачать нельзя', () => {
    expect(isProcessing(info({ state: { id: 2, label: 'To transcode' } }))).toBe(true)
    expect(isProcessing(info({ streamingPlaylists: [], files: [] }))).toBe(true)
    expect(isProcessing(info())).toBe(false)
  })

  it('запомненное качество — ближайшее не выше, а нет такого — самое маленькое', () => {
    const qs = offlineQualities(info())
    expect(pickQuality(qs, 720)?.height).toBe(360)
    expect(pickQuality(qs, 360)?.height).toBe(360)
    expect(pickQuality(qs, 240)?.height).toBe(144)
    expect(pickQuality(qs, 100)?.height).toBe(144)
    expect(pickQuality([], 480)).toBeNull()
  })

  it('копия в архиве: сначала файл рядом с её плейлистом, потом исходный адрес, потом архив', () => {
    const sources = fileSources(
      'https://peertube600.pocketnet.app/static/streaming-playlists/hls/x/f-360.mp4',
      'https://peertube601.pocketnet.app/static/streaming-playlists/hls/x/master.m3u8'
    )
    expect(sources).toEqual([
      'https://peertube601.pocketnet.app/static/streaming-playlists/hls/x/f-360.mp4',
      'https://peertube600.pocketnet.app/static/streaming-playlists/hls/x/f-360.mp4',
    ])
  })

  it('адрес через vite-прокси превращается в настоящий', () => {
    expect(absolutePeerTubeUrl('/api/peertube/h.example/lazy-static/video-captions/a.vtt')).toBe(
      'https://h.example/lazy-static/video-captions/a.vtt'
    )
    expect(absolutePeerTubeUrl('https://h/a.vtt')).toBe('https://h/a.vtt')
    expect(absolutePeerTubeUrl('relative.vtt')).toBeNull()
  })

  it('id папки без лишних символов', () => {
    expect(offlineId(UUID, 360)).toBe(`${UUID}-360`)
    expect(offlineId('../x/y', 144)).toBe('xy-144')
  })

  it('задание и снимок для показа без сети', () => {
    const quality = offlineQualities(info())[0]!
    const { job, meta } = buildOfflineJob({
      source,
      info: info(),
      quality,
      captions: [
        {
          language: 'ru',
          label: 'Русский',
          url: '/api/peertube/peertube701.pocketnet.app/c/ru.vtt',
        },
        { language: 'ru', label: 'Дубль', url: 'https://x/ru2.vtt' },
        { language: '../en', label: 'English', url: 'relative.vtt' },
      ],
      account: 'PMe',
      now: 1000,
    })
    expect(job).toEqual({
      id: `${UUID}-144`,
      sources: [`${BASE}/7f87-144-fragmented.mp4`],
      fileName: '7f87-144-fragmented.mp4',
      sha256Urls: [`${BASE}/4e7e-segments-sha256.json`],
      extras: [
        {
          name: 'thumb.jpg',
          url: 'https://peertube701.pocketnet.app/static/thumbnails/85971e91.jpg',
        },
        { name: 'avatar.jpg', url: 'https://img.example/a.jpg' },
        { name: 'captions/ru.vtt', url: 'https://peertube701.pocketnet.app/c/ru.vtt' },
      ],
      size: 2918128,
    })
    expect(meta).toMatchObject({
      id: `${UUID}-144`,
      peertubeUrl: source.peertubeUrl,
      kind: 'video',
      uuid: UUID,
      postId: source.postId,
      title: 'Заголовок поста',
      description: 'Текст 0:30 глава',
      author: { address: 'PAddr', name: 'Автор' },
      thumb: true,
      avatar: true,
      duration: 104,
      height: 144,
      size: 2918128,
      captions: [{ language: 'ru', label: 'Русский', file: 'captions/ru.vtt' }],
      createdAt: 1000,
      accounts: ['PMe'],
    })
  })

  it('для Android — и плейлист качества рядом с файлом', () => {
    const { job } = buildOfflineJob({
      source,
      info: info(),
      quality: offlineQualities(info())[0]!,
      captions: [],
      account: 'PMe',
      withPlaylist: true,
    })
    expect(job.extras).toContainEqual({ name: 'playlist.m3u8', url: `${BASE}/7f87-144.m3u8` })
    const web = buildOfflineJob({
      source,
      info: info(),
      quality: offlineQualities(info())[0]!,
      captions: [],
      account: 'PMe',
    })
    expect(web.job.extras.some((e) => e.name === 'playlist.m3u8')).toBe(false)
  })

  it('аватар не с http — не качается', () => {
    const { job, meta } = buildOfflineJob({
      source: { ...source, author: { address: 'P', avatarUrl: 'ipfs://cid' } },
      info: info(),
      quality: offlineQualities(info())[0]!,
      captions: [],
      account: 'PMe',
    })
    expect(job.extras.map((e) => e.name)).toEqual(['thumb.jpg'])
    expect(meta.avatar).toBe(false)
  })
})
