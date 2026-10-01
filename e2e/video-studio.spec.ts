import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «Мои видео», как творческая студия YouTube: файл выбран — загрузка идёт,
 * окно сворачивается в плашку «Загрузки», по приложению можно ходить; когда
 * видео загружено, название уходит на сервер, а «Создать пост» открывает
 * редактор с прикреплённым видео. Нода и видеосервер подменные: ответ на
 * загрузку тест придерживает, пока не уйдёт со страницы.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = { profiles: [ALICE], posts: [], comments: [] }

const HOST = 'video.e2e.test'
const UUID = '7d1f0c2e-1111-4222-8333-444455556666'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface VideoServer {
  /** Имена, которые приложение отправило в PUT videos/:uuid. */
  renamed: string[]
  /** Отпустить придержанный ответ на загрузку. */
  release: () => void
}

/** Подменный видеосервер: вход, канал и квота, возобновляемая загрузка, список, имя. */
async function useVideoServer(page: Page): Promise<VideoServer> {
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  const server: VideoServer = { renamed: [], release: () => release() }
  let uploaded = false

  const node = (path: string) => new RegExp(`\\.pocketnet\\.app:8899/peertube/${path}`)
  const nodeAnswer = (route: Route, data: unknown) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ headers: CORS, json: { result: 'success', data } })
  await page.route(node('best'), (route) => nodeAnswer(route, { host: HOST }))
  await page.route(node('roys'), (route) => nodeAnswer(route, { 0: HOST }))

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
  await page.route(api('users/me/video-quota-used'), (route) =>
    route.fulfill({ json: { videoQuotaUsedDaily: 0, videoQuotaUsed: 0 } })
  )
  await page.route(api('users/me/videos*'), (route) =>
    route.fulfill({
      json: uploaded
        ? {
            total: 1,
            data: [
              {
                id: 42,
                uuid: UUID,
                name: server.renamed.at(-1) ?? 'test-video',
                state: { id: 1 },
                duration: 3,
              },
            ],
          }
        : { total: 0, data: [] },
    })
  )
  await page.route(api('videos/upload-resumable*'), async (route) => {
    const method = route.request().method()
    if (method === 'POST') {
      return route.fulfill({
        status: 201,
        headers: { Location: `//${HOST}/api/v1/videos/upload-resumable?upload_id=up1` },
        body: '',
      })
    }
    if (method === 'PUT') {
      await held
      uploaded = true
      return route.fulfill({ json: { video: { id: 42, uuid: UUID, shortUUID: 'short' } } })
    }
    return route.fulfill({ status: 204, body: '' })
  })
  await page.route(api(`videos/${UUID}`), async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const body = route.request().postDataBuffer()?.toString('utf8') ?? ''
    const name = /name="name"\r\n\r\n([^\r]*)/.exec(body)?.[1]
    if (name) server.renamed.push(name)
    return route.fulfill({ status: 204, body: '' })
  })
  return server
}

async function signIn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

test('загрузка в фоне: свернуть, уйти со страницы, затем «Создать пост» с этим видео', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await useMockNode(page, DATA)
  const server = await useVideoServer(page)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await signIn(page)
  await page.goto('/my-videos')
  await expect(page.getByRole('heading', { name: 'Мои видео', level: 1 })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText('Здесь появятся видео, которые вы загрузите.')).toBeVisible({
    timeout: 20_000,
  })
  // Круглой кнопки сжатия больше нет.
  await expect(page.getByRole('button', { name: /Сжатие видео/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Загрузить видео' }).click()
  const dialog = page.getByRole('dialog', { name: 'Загрузка видео' })
  await expect(dialog).toBeVisible()
  await dialog.locator('input[type="file"]').setInputFiles('e2e/fixtures/test-video.mp4')

  const title = page.getByLabel('Название')
  await expect(title).toHaveValue('test-video')
  await title.fill('Море в июле')
  await expect(page.getByText(/Загрузка: \d+\s?%/).first()).toBeVisible()

  // Свернуть: окно закрыто, загрузка идёт в плашке — и после ухода со страницы.
  await page.getByRole('button', { name: 'Свернуть' }).click()
  const panel = page.getByRole('region', { name: 'Загрузки' })
  await expect(panel).toContainText('Загружается: 1')
  // Переход внутри приложения (логотип ведёт в ленту), без перезагрузки страницы.
  await page.getByRole('button', { name: 'Bastyon NextGen' }).first().click()
  await expect(page).not.toHaveURL(/my-videos/)
  await expect(panel).toContainText('Море в июле')

  server.release()
  await expect(panel).toContainText('Загрузки завершены', { timeout: 20_000 })
  await expect.poll(() => server.renamed).toEqual(['Море в июле'])

  await panel.getByRole('button', { name: 'Создать пост' }).click()
  const composer = page.getByRole('dialog', { name: 'Новый пост' })
  await expect(composer).toBeVisible()
  await expect(composer.getByText('Видео PeerTube прикреплено')).toBeVisible()
  await expect(composer.getByLabel('Заголовок видео')).toHaveValue('Море в июле')
  await expect(panel).toHaveCount(0)
})
