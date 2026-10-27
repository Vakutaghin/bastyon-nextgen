// «Медиастудия» и видеосервер: сведения о ролике, описание, правка,
// статистика и отметки плеера — запросы и разбор ответов форка PeerTube 4.2.

import { describe, expect, it, vi } from 'vitest'

import type { InstanceFetch } from './peertube-instance'
import {
  getInstanceVideoDescription,
  getInstanceVideoDetails,
  getVideoStatsOverall,
  getVideoStatsRetention,
  getVideoStatsTimeserie,
  reportVideoView,
  updateInstanceVideo,
  videoFiles,
} from './peertube-video-studio'

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function fakeFetch(response: Response) {
  const calls: Array<{ path: string; init: RequestInit }> = []
  const fetchInstance: InstanceFetch = async (path, init) => {
    calls.push({ path, init: init ?? {} })
    return response
  }
  return { fetchInstance, calls }
}

describe('videoFiles', () => {
  it('HLS и обычные файлы вместе, без повторов по высоте, лучшие первыми', () => {
    expect(
      videoFiles({
        streamingPlaylists: [
          {
            files: [
              { resolution: { id: 360, label: '360p' }, size: 10, fileUrl: 'h360' },
              { resolution: { id: 720, label: '720p' }, size: 30, fileUrl: 'h720' },
            ],
          },
        ],
        files: [
          { resolution: { id: 720, label: '720p' }, size: 31, fileUrl: 'w720' },
          { resolution: { id: 1080, label: '1080p' }, size: 50, fileUrl: 'w1080' },
          { resolution: { id: 480 } },
        ],
      })
    ).toEqual([
      { label: '1080p', height: 1080, size: 50, fileUrl: 'w1080' },
      { label: '720p', height: 720, size: 30, fileUrl: 'h720' },
      { label: '360p', height: 360, size: 10, fileUrl: 'h360' },
    ])
  })
})

describe('getInstanceVideoDetails', () => {
  it('разбирает ответ: просмотры, звук, формат, состояние, файлы', async () => {
    const { fetchInstance, calls } = fakeFetch(
      jsonRes({
        id: 42,
        uuid: 'u-1',
        name: 'Ролик',
        duration: 61,
        views: 7,
        isAudio: false,
        aspectRatio: 1.7778,
        state: { id: 2 },
        createdAt: '2026-10-01T10:00:00.000Z',
        thumbnailPath: '/static/thumbnails/a.jpg',
        previewPath: '/lazy-static/previews/a.jpg',
        streamingPlaylists: [
          { files: [{ resolution: { id: 480, label: '480p' }, size: 5, fileUrl: 'f' }] },
        ],
      })
    )
    const details = await getInstanceVideoDetails({ host: 'h', id: 'u-1', fetchInstance })
    expect(calls[0]!.path).toBe('api/v1/videos/u-1')
    expect(details).toEqual({
      id: 42,
      uuid: 'u-1',
      name: 'Ролик',
      duration: 61,
      views: 7,
      isAudio: false,
      aspectRatio: 1.7778,
      stateId: 2,
      createdAt: '2026-10-01T10:00:00.000Z',
      thumbnailPath: '/static/thumbnails/a.jpg',
      previewPath: '/lazy-static/previews/a.jpg',
      files: [{ label: '480p', height: 480, size: 5, fileUrl: 'f' }],
    })
  })

  it('404 — ролика нет; другая ошибка — исключение', async () => {
    expect(
      await getInstanceVideoDetails({
        host: 'h',
        id: 'x',
        fetchInstance: fakeFetch(jsonRes({}, 404)).fetchInstance,
      })
    ).toBeNull()
    await expect(
      getInstanceVideoDetails({
        host: 'h',
        id: 'x',
        fetchInstance: fakeFetch(jsonRes({}, 500)).fetchInstance,
      })
    ).rejects.toThrow('peertube_video_details_500')
  })
})

describe('getInstanceVideoDescription', () => {
  it('описание целиком; null — пустая строка', async () => {
    const { fetchInstance, calls } = fakeFetch(jsonRes({ description: 'Длинный текст' }))
    expect(await getInstanceVideoDescription({ host: 'h', id: 'u/1', fetchInstance })).toBe(
      'Длинный текст'
    )
    expect(calls[0]!.path).toBe('api/v1/videos/u%2F1/description')
    expect(
      await getInstanceVideoDescription({
        host: 'h',
        id: 'u',
        fetchInstance: fakeFetch(jsonRes({ description: null })).fetchInstance,
      })
    ).toBe('')
  })
})

describe('updateInstanceVideo', () => {
  it('PUT JSON с токеном; null убирает описание', async () => {
    const { fetchInstance, calls } = fakeFetch(new Response(null, { status: 204 }))
    await updateInstanceVideo({
      host: 'h',
      id: 42,
      accessToken: 'AT',
      changes: { name: 'Новое', description: null },
      fetchInstance,
    })
    const { path, init } = calls[0]!
    expect(path).toBe('api/v1/videos/42')
    expect(init.method).toBe('PUT')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer AT',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Новое', description: null })
  })

  it('отказ сервера — исключение с кодом', async () => {
    await expect(
      updateInstanceVideo({
        host: 'h',
        id: 42,
        accessToken: 'AT',
        changes: { name: 'x' },
        fetchInstance: fakeFetch(jsonRes({}, 400)).fetchInstance,
      })
    ).rejects.toThrow('peertube_update_video_400')
  })
})

describe('статистика', () => {
  it('сводка: период уходит обеими датами, страны по убыванию, пустые отброшены', async () => {
    const { fetchInstance, calls } = fakeFetch(
      jsonRes({
        averageWatchTime: 12,
        totalWatchTime: 340,
        totalViewers: 9,
        viewersPeak: 2,
        viewersPeakDate: '2026-10-02T12:00:00.000Z',
        countries: [
          { isoCode: 'DE', viewers: 1 },
          { isoCode: 'RU', viewers: 6 },
          { isoCode: 'FR', viewers: 0 },
        ],
      })
    )
    const overall = await getVideoStatsOverall({
      host: 'h',
      id: 'u',
      accessToken: 'AT',
      period: { startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-10-28T00:00:00.000Z' },
      fetchInstance,
    })
    expect(calls[0]!.path).toBe(
      'api/v1/videos/u/stats/overall?startDate=2026-10-01T00%3A00%3A00.000Z&endDate=2026-10-28T00%3A00%3A00.000Z'
    )
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer AT')
    expect(overall.countries).toEqual([
      { isoCode: 'RU', viewers: 6 },
      { isoCode: 'DE', viewers: 1 },
    ])
    expect(overall.totalViewers).toBe(9)
  })

  it('одна дата периода не уходит: сервер требует обе', async () => {
    const { fetchInstance, calls } = fakeFetch(jsonRes({}))
    await getVideoStatsOverall({
      host: 'h',
      id: 'u',
      accessToken: 'AT',
      period: { startDate: '2026-10-01T00:00:00.000Z' },
      fetchInstance,
    })
    expect(calls[0]!.path).toBe('api/v1/videos/u/stats/overall')
  })

  it('ряд по времени и удержание', async () => {
    const series = await getVideoStatsTimeserie({
      host: 'h',
      id: 'u',
      accessToken: 'AT',
      metric: 'viewers',
      fetchInstance: fakeFetch(
        jsonRes({ groupInterval: 'one_day', data: [{ date: '2026-10-01', value: 3 }, {}] })
      ).fetchInstance,
    })
    expect(series).toEqual({ groupInterval: 'one_day', data: [{ date: '2026-10-01', value: 3 }] })

    const retention = await getVideoStatsRetention({
      host: 'h',
      id: 'u',
      accessToken: 'AT',
      fetchInstance: fakeFetch(
        jsonRes({
          data: [
            { second: 0, retentionPercent: 100 },
            { second: 1, retentionPercent: 140 },
          ],
        })
      ).fetchInstance,
    })
    expect(retention).toEqual([
      { second: 0, retentionPercent: 100 },
      { second: 1, retentionPercent: 100 },
    ])
  })

  it('отказ — исключение с кодом', async () => {
    await expect(
      getVideoStatsRetention({
        host: 'h',
        id: 'u',
        accessToken: 'AT',
        fetchInstance: fakeFetch(jsonRes({}, 403)).fetchInstance,
      })
    ).rejects.toThrow('peertube_video_stats_403')
  })
})

describe('reportVideoView', () => {
  it('POST JSON без входа; 204 и 409 — отметка принята', async () => {
    const ok = fakeFetch(new Response(null, { status: 204 }))
    expect(
      await reportVideoView({
        host: 'h',
        id: 'u',
        report: { currentTime: 15, viewEvent: 'seek' },
        fetchInstance: ok.fetchInstance,
      })
    ).toBe(true)
    expect(ok.calls[0]!.path).toBe('api/v1/videos/u/views')
    expect(ok.calls[0]!.init.method).toBe('POST')
    expect(JSON.parse(ok.calls[0]!.init.body as string)).toEqual({
      currentTime: 15,
      viewEvent: 'seek',
    })
    expect((ok.calls[0]!.init.headers as Record<string, string>).Authorization).toBeUndefined()

    const seen = vi.fn(async () => new Response(null, { status: 409 }))
    expect(
      await reportVideoView({
        host: 'h',
        id: 'u',
        report: { currentTime: 20 },
        fetchInstance: seen,
      })
    ).toBe(true)
    expect(
      await reportVideoView({
        host: 'h',
        id: 'u',
        report: { currentTime: 20 },
        fetchInstance: fakeFetch(jsonRes({}, 404)).fetchInstance,
      })
    ).toBe(false)
  })
})
