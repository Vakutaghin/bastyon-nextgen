import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page, Route } from '@playwright/test'

/**
 * Подменный PeerTube для e2e плеера: описание ролика без HLS (плеер берёт
 * прямой mp4), сам ролик и превью из e2e/fixtures. API в dev идёт через
 * vite-прокси `/api/peertube/<хост>/…`, файлы — по абсолютным адресам хоста.
 * Маршруты на странице, поэтому главнее обрывающего всё внешнее mock-node.
 */

export const PEERTUBE_HOST = 'video.e2e.test'
export const VIDEO_ID = 'e2e-video'
/** Ссылка поста на ролик: 30 секунд, 426×240, ключевой кадр каждую секунду. */
export const VIDEO_URL = `peertube://${PEERTUBE_HOST}/${VIDEO_ID}`

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))

/**
 * Ролик кусками по `Range`, как отдаёт настоящий сервер: без этого браузер
 * считает видео неперематываемым и любая перемотка возвращает его в начало.
 */
function fulfillVideo(route: Route, video: Buffer): Promise<void> {
  const total = video.length
  const match = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '')
  const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' }
  if (!match) return route.fulfill({ status: 200, body: video, headers })
  const start = Number(match[1])
  const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1
  return route.fulfill({
    status: 206,
    body: video.subarray(start, end + 1),
    headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}` },
  })
}

export async function useMockPeerTube(page: Page): Promise<void> {
  const info = {
    uuid: VIDEO_ID,
    name: 'Тестовый ролик',
    duration: 30,
    thumbnailPath: `/static/thumbnails/${VIDEO_ID}.jpg`,
    streamingPlaylists: [],
    files: [
      {
        fileUrl: `https://${PEERTUBE_HOST}/static/web-videos/${VIDEO_ID}-240.mp4`,
        resolution: { id: 240, label: '240p' },
      },
    ],
  }
  await page.route(`**/api/v1/videos/${VIDEO_ID}`, (route) => route.fulfill({ json: info }))
  await page.route(`**/api/v1/videos/${VIDEO_ID}/captions`, (route) =>
    route.fulfill({ json: { total: 0, data: [] } })
  )
  await page.route(`**/static/thumbnails/${VIDEO_ID}.jpg`, (route) =>
    route.fulfill({ path: fixture('test-video.jpg'), contentType: 'image/jpeg' })
  )
  const video = readFileSync(fixture('test-video.mp4'))
  await page.route(`**/static/web-videos/${VIDEO_ID}-240.mp4`, (route) =>
    fulfillVideo(route, video)
  )
}
