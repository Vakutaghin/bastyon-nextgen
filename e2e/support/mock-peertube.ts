import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page, Route } from '@playwright/test'

/**
 * Подменный PeerTube для e2e плеера: описание ролика, сам ролик и превью из
 * e2e/fixtures. API в dev идёт через vite-прокси `/api/peertube/<хост>/…`,
 * файлы — по абсолютным адресам хоста. Маршруты на странице, поэтому
 * главнее обрывающего всё внешнее mock-node.
 *
 * По умолчанию у ролика нет HLS, и плеер берёт прямой mp4. С `hls` описание
 * как у настоящего PeerTube: master-плейлист, плейлист качества и один
 * фрагментированный mp4, который плеер читает кусками по `Range`.
 */

export const PEERTUBE_HOST = 'video.e2e.test'
export const VIDEO_ID = 'e2e-video'
/** Ссылка поста на ролик: 30 секунд, 426×240, ключевой кадр каждую секунду. */
export const VIDEO_URL = `peertube://${PEERTUBE_HOST}/${VIDEO_ID}`

export interface MockPeerTubeOptions {
  /** Нода в ссылке поста (по умолчанию {@link PEERTUBE_HOST}). */
  linkHost?: string
  /** Ролик отдаёт другая нода (архив), а нода из ссылки не отвечает. */
  servedBy?: string
  /** Где ролик лежит, знает только прокси Bastyon (`/peertube/video`). */
  onlyProxyKnows?: boolean
  /** Отдавать ролик через HLS, как настоящий PeerTube. */
  hls?: boolean
  /** Сколько кусков HLS отдать, прежде чем нода перестанет их отдавать. */
  hlsBreaksAfter?: number
}

export interface MockPeerTube {
  /** Сколько раз плеер запрашивал куски HLS и прямой mp4. */
  requests: { hls: number; mp4: number }
}

const HLS_PLAYLIST = 'test-video-240.m3u8'
const HLS_FILE = 'test-video-240-fragmented.mp4'

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))

/**
 * Ролик кусками по `Range`, как отдаёт настоящий сервер: без этого браузер
 * считает видео неперематываемым и любая перемотка возвращает его в начало.
 */
function fulfillVideo(route: Route, video: Buffer): Promise<void> {
  const total = video.length
  const match = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '')
  const headers = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
  }
  if (!match) return route.fulfill({ status: 200, body: video, headers })
  const start = Number(match[1])
  const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1
  return route.fulfill({
    status: 206,
    body: video.subarray(start, end + 1),
    headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}` },
  })
}

export async function useMockPeerTube(
  page: Page,
  options: MockPeerTubeOptions = {}
): Promise<MockPeerTube> {
  const linkHost = options.linkHost ?? PEERTUBE_HOST
  const host = options.servedBy ?? linkHost
  const hlsBase = `https://${host}/static/streaming-playlists/hls/${VIDEO_ID}`
  const mock: MockPeerTube = { requests: { hls: 0, mp4: 0 } }

  const info = {
    uuid: VIDEO_ID,
    name: 'Тестовый ролик',
    duration: 30,
    thumbnailPath: `/static/thumbnails/${VIDEO_ID}.jpg`,
    streamingPlaylists: options.hls
      ? [
          {
            id: 1,
            playlistUrl: `${hlsBase}/master.m3u8`,
            files: [{ fileUrl: `${hlsBase}/${HLS_FILE}`, resolution: { id: 240, label: '240p' } }],
          },
        ]
      : [],
    files: [
      {
        fileUrl: `https://${host}/static/web-videos/${VIDEO_ID}-240.mp4`,
        resolution: { id: 240, label: '240p' },
      },
    ],
  }

  if (host !== linkHost) {
    // Нода из ссылки выведена из работы: не отвечает ни API, ни файлами.
    await page.route(`**/api/peertube/${linkHost}/**`, (route) => route.abort())
    await page.route(`https://${linkHost}/**`, (route) => route.abort())
  }
  if (options.onlyProxyKnows) {
    // Прокси старого клиента отвечает `{ data: <описание> }` и пишет в `from`,
    // какая нода ролик отдала.
    await page.route(/\.pocketnet\.app:8899\/peertube\/video/, (route) =>
      route.fulfill({
        headers: { 'Access-Control-Allow-Origin': '*' },
        json: { result: 'success', data: { data: { ...info, from: host } } },
      })
    )
  } else {
    await page.route(`**/api/peertube/${host}/api/v1/videos/${VIDEO_ID}`, (route) =>
      route.fulfill({ json: info })
    )
  }
  await page.route(`**/api/peertube/${host}/api/v1/videos/${VIDEO_ID}/captions`, (route) =>
    route.fulfill({ json: { total: 0, data: [] } })
  )
  await page.route(`https://${host}/static/thumbnails/${VIDEO_ID}.jpg`, (route) =>
    route.fulfill({ path: fixture('test-video.jpg'), contentType: 'image/jpeg' })
  )

  const video = readFileSync(fixture('test-video.mp4'))
  await page.route(`https://${host}/static/web-videos/${VIDEO_ID}-240.mp4`, (route) => {
    mock.requests.mp4 += 1
    return fulfillVideo(route, video)
  })

  if (options.hls) {
    const cors = { 'Access-Control-Allow-Origin': '*' }
    const master = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-STREAM-INF:BANDWIDTH=80000,RESOLUTION=426x240,FRAME-RATE=25,CODECS="avc1.640015,mp4a.40.2"',
      HLS_PLAYLIST,
    ].join('\n')
    await page.route(`${hlsBase}/master.m3u8`, (route) =>
      route.fulfill({ body: master, contentType: 'application/vnd.apple.mpegurl', headers: cors })
    )
    await page.route(`${hlsBase}/${HLS_PLAYLIST}`, (route) =>
      route.fulfill({
        path: fixture(HLS_PLAYLIST),
        contentType: 'application/vnd.apple.mpegurl',
        headers: cors,
      })
    )
    const fragmented = readFileSync(fixture(HLS_FILE))
    await page.route(`${hlsBase}/${HLS_FILE}`, (route) => {
      mock.requests.hls += 1
      if (options.hlsBreaksAfter !== undefined && mock.requests.hls > options.hlsBreaksAfter) {
        return route.abort()
      }
      return fulfillVideo(route, fragmented)
    })
  }

  return mock
}
