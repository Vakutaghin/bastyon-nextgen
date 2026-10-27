import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «Медиастудия», как творческая студия YouTube: файл выбран — загрузка идёт,
 * окно сворачивается в плашку «Загрузки», по приложению можно ходить; когда
 * видео загружено, название уходит на сервер, а «Создать пост» открывает
 * редактор с прикреплённым видео. Нода и видеосервер подменные: ответ на
 * загрузку тест придерживает, пока не уйдёт со страницы. Обложка — первый
 * кадр, снятый в окне из файла, кадр с ленты или своя картинка.
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

/** Обложка, присланная в PUT videos/:uuid. */
interface SentCover {
  thumbnail: boolean
  preview: boolean
  /** Content-Type части с картинкой. */
  type: string
  /**
   * Байты начинаются как JPEG; null — перехват их не видит: Playwright WebKit
   * отдаёт у файла в multipart только заголовки.
   */
  jpegBytes: boolean | null
}

/** Часть multipart-тела по имени поля: тип и байты файла. */
function multipartFile(body: Buffer, field: string): { type: string; data: Buffer } | null {
  const header = body.indexOf(`name="${field}"`)
  if (header < 0) return null
  const start = body.indexOf('\r\n\r\n', header) + 4
  const end = body.indexOf('\r\n--', start)
  const head = body.subarray(header, start).toString('utf8')
  return {
    type: /Content-Type: ([^\r]+)/i.exec(head)?.[1] ?? '',
    data: body.subarray(start, end),
  }
}

interface VideoServer {
  /** Имена, которые приложение отправило в PUT videos/:uuid. */
  renamed: string[]
  covers: SentCover[]
  /** Отпустить придержанный ответ на загрузку. */
  release: () => void
}

/** Подменный видеосервер: вход, канал и квота, возобновляемая загрузка, список, имя. */
/** Обложка, которую подменный сервер «сделал сам». */
const SERVER_COVER = `https://${HOST}/lazy-static/previews/server-cover.jpg`

async function useVideoServer(page: Page, options: { audio?: boolean } = {}): Promise<VideoServer> {
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  const server: VideoServer = { renamed: [], covers: [], release: () => release() }
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
      return route.fulfill({
        json: { video: { id: 42, uuid: UUID, shortUUID: 'short', isAudio: !!options.audio } },
      })
    }
    return route.fulfill({ status: 204, body: '' })
  })
  await page.route(api(`videos/${UUID}`), async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        headers: CORS,
        json: { id: 42, uuid: UUID, previewPath: new URL(SERVER_COVER).pathname },
      })
    }
    if (route.request().method() !== 'PUT') return route.fallback()
    const raw = route.request().postDataBuffer() ?? Buffer.alloc(0)
    const body = raw.toString('utf8')
    const name = /name="name"\r\n\r\n([^\r]*)/.exec(body)?.[1]
    if (name) server.renamed.push(name)
    const thumbnail = multipartFile(raw, 'thumbnailfile')
    if (thumbnail) {
      const { type, data } = thumbnail
      server.covers.push({
        thumbnail: true,
        preview: !!multipartFile(raw, 'previewfile'),
        type,
        jpegBytes: data.length ? data[0] === 0xff && data[1] === 0xd8 : null,
      })
    }
    return route.fulfill({ status: 204, body: '' })
  })
  await page.route(SERVER_COVER, (route) =>
    route.fulfill({ path: 'e2e/fixtures/test-video.jpg', contentType: 'image/jpeg' })
  )
  return server
}

function expectJpegCover(cover: SentCover | undefined, browserName: string): void {
  expect(cover).toMatchObject({ thumbnail: true, preview: true, type: 'image/jpeg' })
  if (browserName === 'chromium') expect(cover!.jpegBytes).toBe(true)
}

/** Ползунок по ленте кадров: отпустили на `seconds`. */
async function pickFrame(page: Page, seconds: number): Promise<void> {
  await page.getByTestId('video-cover-range').evaluate((el, value) => {
    const input = el as HTMLInputElement
    input.value = String(value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, seconds)
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
  await expect(page.getByRole('heading', { name: 'Медиастудия', level: 1 })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText('Здесь появятся видео и аудио, которые вы загрузите.')).toBeVisible({
    timeout: 20_000,
  })
  // Круглой кнопки сжатия больше нет.
  await expect(page.getByRole('button', { name: /Сжатие видео/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Загрузить', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Загрузка видео или звука' })
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

test('обложка: первый кадр по умолчанию, кадр с ленты, своя картинка', async ({
  page,
  browserName,
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
  await page.getByRole('button', { name: 'Загрузить', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Загрузка видео или звука' })
    .locator('input[type="file"]')
    .setInputFiles('e2e/fixtures/test-video.mp4')
  // Файл выбран — окно называется по ролику.
  const dialog = page.getByRole('dialog', { name: 'test-video' })

  // Первый кадр снят прямо в окне, сервер получит его после загрузки.
  const cover = dialog.getByRole('img', { name: 'Обложка' })
  await expect(cover).toHaveAttribute('src', /^blob:/, { timeout: 15_000 })
  await expect(dialog.getByText('Первый кадр')).toBeVisible()
  await expect(dialog.getByText('Сохранится, когда видео загрузится')).toBeVisible()
  // Лента кадров под превью.
  await expect(dialog.locator('img[src^="blob:"]')).toHaveCount(9, { timeout: 15_000 })

  await dialog.getByRole('button', { name: 'Как выбрать обложку' }).click()
  await expect(page.getByRole('tooltip')).toContainText('первые секунду-две')

  // Кадр с ленты: во время загрузки, сервер получит только его.
  const firstSrc = await cover.getAttribute('src')
  await pickFrame(page, 15)
  await expect(dialog.getByText('Кадр 0:15')).toBeVisible()
  await expect(cover).not.toHaveAttribute('src', firstSrc!)

  server.release()
  await expect(dialog.getByText('Обложка сохранена')).toBeVisible({ timeout: 20_000 })
  expect(server.covers).toHaveLength(1)
  expectJpegCover(server.covers[0], browserName)

  // Своя картинка после загрузки уходит сразу.
  await dialog
    .locator('input[type="file"][accept^="image"]')
    .setInputFiles('e2e/fixtures/test-video.jpg')
  await expect(dialog.getByText('Своя картинка')).toBeVisible()
  await expect.poll(() => server.covers.length).toBe(2)
  await expect(dialog.getByText('Обложка сохранена')).toBeVisible()
  expectJpegCover(server.covers[1], browserName)
})

test('обложка в окне поста: «Изменить обложку», публикация ждёт её', async ({
  page,
  browserName,
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
  await page.getByRole('button', { name: 'Создать пост' }).first().click()
  const composer = page.getByRole('dialog', { name: 'Новый пост' })
  await composer
    .locator('input[type="file"][accept^="video"]')
    .setInputFiles('e2e/fixtures/test-video.mp4')

  await expect(composer.getByText('Первый кадр')).toBeVisible({ timeout: 15_000 })
  await composer.getByRole('button', { name: 'Изменить обложку' }).click()
  const picker = page.getByRole('dialog', { name: 'Обложка' })
  await expect(picker).toBeVisible()
  await pickFrame(page, 20)
  await expect(picker.getByText('Кадр 0:20')).toBeVisible()
  await picker.getByRole('button', { name: 'Готово' }).click()
  await expect(picker).toBeHidden()
  await expect(composer.getByText('Кадр 0:20')).toBeVisible()

  server.release()
  await expect(composer.getByText('Видео PeerTube прикреплено')).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => server.covers.length).toBe(1)
  expectJpegCover(server.covers[0], browserName)
})

test('обложка звука: без своей — та, что сделал сервер; своя картинка уходит после загрузки', async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000)
  await useMockNode(page, DATA)
  const server = await useVideoServer(page, { audio: true })
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await signIn(page)
  await page.goto('/my-videos')
  await expect(page.getByRole('heading', { name: 'Медиастудия', level: 1 })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Загрузить', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Загрузка видео или звука' })
    .locator('input[type="file"]')
    .setInputFiles('e2e/fixtures/test-audio.mp3')
  const dialog = page.getByRole('dialog', { name: 'test-audio' })

  // Кадров у звука нет: ни ленты, ни ползунка — только своя картинка.
  await expect(dialog.getByText('Без своей картинки обложку сделает видеосервер')).toBeVisible()
  await expect(dialog.getByTestId('video-cover-range')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Как выбрать обложку' }).click()
  await expect(page.getByRole('tooltip')).toContainText('обложку альбома')
  await dialog.getByText('Название', { exact: true }).click()

  server.release()
  // Загружено — видна обложка, которую сделал сервер.
  const cover = dialog.getByRole('img', { name: 'Обложка' })
  await expect(cover).toHaveAttribute('src', SERVER_COVER, { timeout: 20_000 })
  await expect(dialog.getByText('От видеосервера')).toBeVisible()
  await expect(dialog.getByText('Аудио загружено')).toBeVisible()
  expect(server.covers).toHaveLength(0)

  await dialog
    .locator('input[type="file"][accept^="image"]')
    .setInputFiles('e2e/fixtures/test-video.jpg')
  await expect(dialog.getByText('Своя картинка')).toBeVisible()
  await expect.poll(() => server.covers.length).toBe(1)
  await expect(dialog.getByText('Обложка сохранена')).toBeVisible()
  expectJpegCover(server.covers[0], browserName)
  await expect(cover).toHaveAttribute('src', /^blob:/)

  await dialog.getByRole('button', { name: 'Создать пост' }).click()
  const composer = page.getByRole('dialog', { name: 'Новый пост' })
  await expect(composer.getByText('Аудио PeerTube прикреплено')).toBeVisible()
})

test('видеотека: ролики из постов на любом сервере, пост открывается в окне', async ({ page }) => {
  test.setTimeout(120_000)
  // Старый ролик лежит не на сервере загрузки, а на другом: его видно по постам.
  const OLD_HOST = 'old.e2e.test'
  const pointer = `peertube://${OLD_HOST}/0a1b2c3d-1111-4222-8333-444455556666`
  const data: MockNodeData = {
    profiles: [ALICE],
    posts: [
      {
        txid: 'a'.repeat(64),
        address: ALICE.address,
        type: 'video',
        url: pointer,
        caption: 'Меш-сети, часть 2',
        message: 'Продолжение про меш-сети',
      },
      {
        txid: 'b'.repeat(64),
        address: ALICE.address,
        type: 'video',
        url: pointer,
        caption: 'Меш-сети, часть 1',
        message: 'Первый пост про меш-сети',
      },
    ],
    comments: [],
  }
  await useMockNode(page, data)
  await useVideoServer(page)
  await page.route(/\.pocketnet\.app:8899\/peertube\/videos/, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({
          headers: CORS,
          json: {
            result: 'success',
            data: { [pointer]: { id: 5, name: 'Меш-сети', duration: 610, state: { id: 1 } } },
          },
        })
  )
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await signIn(page)
  // Видеотека — посты своего аккаунта: нода отдаёт ленту только этого автора.
  const me = await page.evaluate(() => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $pinia: { _s: Map<string, { getUserAddress: string }> } } }
        }
      }
    ).__vue_app__
    return app.config.globalProperties.$pinia._s.get('auth')!.getUserAddress
  })
  for (const post of data.posts) post.address = me
  data.profiles.push({ address: me, name: ALICE.name })
  await page.goto('/my-videos')

  const card = page.getByRole('listitem').filter({ hasText: 'Меш-сети' })
  await expect(card).toBeVisible({ timeout: 30_000 })
  await expect(card).toContainText('В посте')
  await expect(card).toContainText('10:10')
  // «Обновить» — иконка рядом с «Загрузить видео»; заголовка раздела больше нет.
  await expect(page.getByRole('button', { name: 'Обновить' })).toBeVisible()
  await expect(page.getByText('На видеосервере')).toHaveCount(0)

  await card.getByRole('button', { name: 'Посты: 2' }).click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem')).toHaveCount(2)
  await menu.getByRole('menuitem', { name: /часть 1/ }).click()
  await expect(page.getByText('Первый пост про меш-сети')).toBeVisible({ timeout: 20_000 })
})
