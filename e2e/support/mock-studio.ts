import { expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './mock-node'

/**
 * Подменный видеосервер «Медиастудии»: вход, свои ролики (видео и аудио),
 * сведения и описание ролика, правка (JSON и обложка), статистика, файл
 * ролика и картинки. Записывает, что приложение отправило.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = { profiles: [ALICE], posts: [], comments: [] }

const HOST = 'video.e2e.test'
const UUID = '7d1f0c2e-1111-4222-8333-444455556666'
const AUDIO_UUID = '9e8d7c6b-1111-4222-8333-444455556666'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
}
const FILE_URL = `https://${HOST}/static/streaming-playlists/hls/${UUID}/f-240-fragmented.mp4`

export interface StudioServer {
  /** Тела PUT videos/:uuid в JSON: название и описание. */
  texts: unknown[]
  /** PUT videos/:uuid с обложкой: тип картинки. */
  covers: string[]
  /** Запросы статистики: путь с параметрами. */
  stats: string[]
}

export async function useStudioServer(page: Page): Promise<StudioServer> {
  const server: StudioServer = { texts: [], covers: [], stats: [] }
  const node = (path: string) => new RegExp(`\\.pocketnet\\.app:8899/peertube/${path}`)
  const nodeAnswer = (route: Route, data: unknown) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ headers: CORS, json: { result: 'success', data } })
  await page.route(node('best'), (route) => nodeAnswer(route, { host: HOST }))
  await page.route(node('roys'), (route) => nodeAnswer(route, { 0: HOST }))
  await page.route(node('videos'), (route) => nodeAnswer(route, {}))

  const api = (path: string) => `**/api/peertube/${HOST}/api/v1/${path}`
  await page.route(api('oauth-clients/local'), (route) =>
    route.fulfill({ json: { client_id: 'cid', client_secret: 'secret' } })
  )
  await page.route(api('users/blockChainAuth'), (route) =>
    route.fulfill({ json: { externalAuthToken: 'ext', username: 'alice', isNewUser: false } })
  )
  await page.route(api('users/token'), (route) =>
    route.fulfill({
      json: {
        access_token: 'AT',
        refresh_token: 'RT',
        expires_in: 3600,
        refresh_token_expires_in: 86400,
      },
    })
  )
  await page.route(api('users/me'), (route) =>
    route.fulfill({ json: { videoChannels: [{ id: 7 }], videoQuotaDaily: -1, videoQuota: -1 } })
  )

  let name = 'Закат на море'
  let description = 'Снимали с пирса в Анапе'
  await page.route(api('users/me/videos*'), (route) =>
    route.fulfill({
      json: {
        total: 2,
        data: [
          {
            id: 42,
            uuid: UUID,
            name,
            description: description.slice(0, 250),
            views: 1234,
            duration: 3,
            state: { id: 1 },
            thumbnailPath: '/static/thumbnails/video.jpg',
            createdAt: '2026-10-20T10:00:00.000Z',
          },
          {
            id: 43,
            uuid: AUDIO_UUID,
            name: 'Голосовая заметка',
            description: null,
            views: 3,
            isAudio: true,
            duration: 2,
            state: { id: 1 },
            createdAt: '2026-10-21T10:00:00.000Z',
          },
        ],
      },
    })
  )

  // Статистика — до общего маршрута ролика: Playwright берёт последний подходящий.
  await page.route(api(`videos/${UUID}`), async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      return route.fulfill({
        headers: CORS,
        json: {
          id: 42,
          uuid: UUID,
          name,
          duration: 3,
          views: 1234,
          isAudio: false,
          aspectRatio: 1.7778,
          state: { id: 1 },
          createdAt: '2026-10-20T10:00:00.000Z',
          thumbnailPath: '/static/thumbnails/video.jpg',
          previewPath: '/lazy-static/previews/video.jpg',
          streamingPlaylists: [
            {
              files: [{ resolution: { id: 240, label: '240p' }, size: 120_000, fileUrl: FILE_URL }],
            },
          ],
        },
      })
    }
    if (request.method() !== 'PUT') return route.fallback()
    const type = request.headers()['content-type'] ?? ''
    if (type.includes('application/json')) {
      const body = request.postDataJSON() as { name?: string; description?: string | null }
      server.texts.push(body)
      if (body.name) name = body.name
      if (body.description !== undefined) description = body.description ?? ''
    } else {
      const raw = request.postDataBuffer()?.toString('latin1') ?? ''
      const part = /name="thumbnailfile"[^\r]*\r\nContent-Type: ([^\r]+)/i.exec(raw)
      server.covers.push(part?.[1] ?? '')
    }
    return route.fulfill({ status: 204, body: '' })
  })
  await page.route(api(`videos/${UUID}/description`), (route) =>
    route.fulfill({ headers: CORS, json: { description } })
  )
  await page.route(api(`videos/${UUID}/stats/**`), (route) => {
    const url = new URL(route.request().url())
    server.stats.push(url.pathname.split('/stats/')[1] + url.search)
    if (url.pathname.endsWith('/overall')) {
      return route.fulfill({
        json: {
          averageWatchTime: 75,
          totalWatchTime: 3900,
          totalViewers: 52,
          viewersPeak: 3,
          viewersPeakDate: '2026-10-27T10:00:00.000Z',
          countries: [
            { isoCode: 'RU', viewers: 40 },
            { isoCode: 'DE', viewers: 12 },
          ],
        },
      })
    }
    if (url.pathname.endsWith('/retention')) {
      return route.fulfill({
        json: {
          data: [
            { second: 0, retentionPercent: 100 },
            { second: 1, retentionPercent: 70 },
            { second: 2, retentionPercent: 40 },
            { second: 3, retentionPercent: 25 },
          ],
        },
      })
    }
    return route.fulfill({
      json: {
        groupInterval: '1 day',
        data: [
          { date: '2026-10-25T00:00:00.000Z', value: 8 },
          { date: '2026-10-26T00:00:00.000Z', value: 19 },
          { date: '2026-10-27T00:00:00.000Z', value: 25 },
        ],
      },
    })
  })

  // Картинки и файл ролика — прямо с сервера, как в приложении.
  await page.route(`https://${HOST}/**/*.jpg`, (route) =>
    route.fulfill({ path: 'e2e/fixtures/test-video.jpg', contentType: 'image/jpeg', headers: CORS })
  )
  await page.route(FILE_URL, (route) =>
    route.fulfill({
      path: 'e2e/fixtures/test-video-240-fragmented.mp4',
      contentType: 'video/mp4',
      headers: CORS,
    })
  )
  return server
}

export async function openStudio(page: Page): Promise<StudioServer> {
  await useMockNode(page, DATA)
  const server = await useStudioServer(page)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
  await page.goto('/my-videos')
  await expect(page.getByRole('listitem').filter({ hasText: 'Закат на море' })).toBeVisible({
    timeout: 30_000,
  })
  return server
}
