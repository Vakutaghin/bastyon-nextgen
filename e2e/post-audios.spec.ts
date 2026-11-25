import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type Locator, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { p2pkhScript } from './support/p2pkh'

/**
 * Несколько записей в одном посте — аудиокнига, альбом. Играет мини-плеер:
 * записи идут подряд, книга продолжается с той, на которой остановились. В
 * окне поста файлы грузятся по очереди, их можно назвать и переставить, а в
 * сеть список уходит в настройках поста. Нода и видеосервер подменные.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const ME = { address: 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy', name: 'tester_me', reputation: 500 }
const HOST = 'video.e2e.test'
const MP3 = readFileSync(join(process.cwd(), 'e2e/fixtures/test-audio.mp3'))
const BOOK = 'a'.repeat(64)
const part = (n: number) => `peertube://${HOST}/chapter-${n}/audio`

const book = (count: number): MockNodeData => ({
  profiles: [ALICE, ME],
  posts: [
    {
      txid: BOOK,
      address: ALICE.address,
      message: 'Слушайте по главам',
      caption: 'Моя аудиокнига',
      type: 'audio',
      url: part(1),
      tags: ['аудиокнига'],
      settings: {
        f: '0',
        audios: Array.from({ length: count }, (_, i) => ({
          u: part(i + 1),
          c: `Глава ${i + 1}`,
          d: 2,
        })),
      },
    },
  ],
  comments: [],
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function fulfillAudio(route: Route): Promise<void> {
  const match = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '')
  const headers = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', ...CORS }
  if (!match) return route.fulfill({ status: 200, body: MP3, headers })
  const start = Number(match[1])
  const end = match[2] ? Math.min(Number(match[2]), MP3.length - 1) : MP3.length - 1
  return route.fulfill({
    status: 206,
    body: MP3.subarray(start, end + 1),
    headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${MP3.length}` },
  })
}

/** Видеосервер, который отдаёт главы; `played` — что у него просили играть. */
async function useChapters(page: Page): Promise<{ played: string[]; views: string[] }> {
  const state = { played: [] as string[], views: [] as string[] }
  await page.route(
    new RegExp(`/api/peertube/${HOST}/api/v1/videos/(chapter-\\d+)$`),
    (route: Route) => {
      const id = /videos\/(chapter-\d+)/.exec(route.request().url())![1]!
      return route.fulfill({
        json: {
          uuid: id,
          name: id,
          duration: 2,
          streamingPlaylists: [],
          files: [
            {
              fileUrl: `https://${HOST}/static/${id}.mp3`,
              resolution: { id: 0, label: 'Audio' },
            },
          ],
        },
      })
    }
  )
  await page.route(
    new RegExp(`/api/peertube/${HOST}/api/v1/videos/chapter-\\d+/views`),
    (route) => {
      state.views.push(route.request().url())
      return route.fulfill({ status: 204, body: '' })
    }
  )
  await page.route(`https://${HOST}/static/*.mp3`, (route) => {
    const id = /(chapter-\d+)\.mp3/.exec(route.request().url())![1]!
    if (state.played.at(-1) !== id) state.played.push(id)
    return fulfillAudio(route)
  })
  return state
}

async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

async function signIn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

const album = (page: Page): Locator => page.getByTestId('post-audios').first()
const row = (page: Page, n: number): Locator =>
  album(page)
    .getByTestId('post-audio-row')
    .nth(n - 1)
const player = (page: Page): Locator => page.getByTestId('mini-player')

test.setTimeout(120_000)

test('книга играет подряд, главы листаются в мини-плеере, после перезапуска — с той же главы', async ({
  page,
}) => {
  await useMockNode(page, book(3))
  const server = await useChapters(page)
  await openApp(page)

  await expect(album(page)).toBeVisible()
  await expect(album(page)).toContainText('3 записи · 0:06')
  // Карточка вместо плеера: второго плеера в посте нет.
  await expect(page.getByTestId('post-media')).toHaveCount(0)

  await row(page, 1).click()
  await expect(player(page)).toContainText('Глава 1')
  await expect(player(page)).toContainText(ALICE.name)
  await expect(row(page, 1)).toHaveAttribute('aria-current', 'true')
  // Глава — две секунды: дальше идёт сама.
  await expect(row(page, 2)).toHaveAttribute('aria-current', 'true', { timeout: 20_000 })
  await expect(player(page)).toContainText('Глава 2')
  await expect(row(page, 3)).toHaveAttribute('aria-current', 'true', { timeout: 20_000 })
  expect(server.played.slice(0, 3)).toEqual(['chapter-1', 'chapter-2', 'chapter-3'])

  // Очередь мини-плеера — вся книга; название ведёт на пост.
  await player(page).getByRole('button', { name: 'Очередь' }).click()
  const queue = page.getByTestId('mini-player-queue')
  await expect(queue.locator('li')).toHaveCount(3)
  await expect(page.getByTestId('mini-player-source')).toHaveText('Моя аудиокнига')
  await queue.locator('li').nth(1).getByRole('button').click()
  await expect(row(page, 2)).toHaveAttribute('aria-current', 'true')
  await row(page, 2).click()

  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await expect(album(page)).toContainText('Продолжить: Глава 2')
  await page.getByTestId('post-audios-play').first().click()
  await expect(row(page, 2)).toHaveAttribute('aria-current', 'true')

  // Страница поста — по обложке мини-плеера.
  await player(page).getByRole('button', { name: 'Открыть публикацию' }).click()
  await expect(page).toHaveURL(new RegExp(`/post/${BOOK}`))
})

test('раздел «Аудио»: книга — одной строкой, в очередь встаёт целиком', async ({ page }) => {
  await useMockNode(page, book(3))
  await useChapters(page)
  await openApp(page)
  await page.goto('/audio')
  const track = page.getByTestId('track-row').filter({ hasText: 'Моя аудиокнига' })
  await expect(track).toContainText('3 записи')
  await expect(track).toContainText('0:06')
  await track.getByRole('button', { name: 'Играть' }).first().click()
  await expect(player(page)).toContainText('Глава 1')
  await player(page).getByRole('button', { name: 'Следующий' }).click()
  await expect(player(page)).toContainText('Глава 2')
})

test.describe('телефон', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true })

  test('длинный список свёрнут и помещается в ширину', async ({ page }) => {
    await useMockNode(page, book(30))
    await useChapters(page)
    await openApp(page)
    const rows = album(page).getByTestId('post-audio-row')
    await expect(rows).toHaveCount(5)
    await album(page).getByRole('button', { name: 'Показать все: 30' }).tap()
    await expect(rows).toHaveCount(30)
    const box = (await album(page).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(360)
    for (const n of [1, 30]) {
      const r = (await rows.nth(n - 1).boundingBox())!
      expect(r.x + r.width).toBeLessThanOrEqual(360)
      expect(r.height).toBeGreaterThanOrEqual(36)
    }
  })
})

/** Подменный видеосервер для загрузки: каждая запись получает свой uuid. */
async function useUploads(page: Page): Promise<{ names: string[]; failNext: boolean }> {
  const state = { names: [] as string[], failNext: false }
  const nodeAnswer = (route: Route, data: unknown) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ headers: CORS, json: { result: 'success', data } })
  for (const [path, data] of [
    ['best', { host: HOST }],
    ['roys', { 0: HOST }],
  ] as const)
    await page.route(new RegExp(`\\.pocketnet\\.app:8899/peertube/${path}`), (route) =>
      nodeAnswer(route, data)
    )
  const api = (path: string) => `**/api/peertube/${HOST}/api/v1/${path}`
  const json = (path: string, body: unknown) =>
    page.route(api(path), (route) => route.fulfill({ json: body }))
  await json('oauth-clients/local', { client_id: 'cid', client_secret: 'secret' })
  await json('users/blockChainAuth', { externalAuthToken: 'ext', username: 'me', isNewUser: false })
  await json('users/token', {
    access_token: 'AT',
    refresh_token: 'RT',
    expires_in: 3600,
    refresh_token_expires_in: 86400,
  })
  await json('users/me', { videoChannels: [{ id: 7 }], videoQuotaDaily: -1, videoQuota: -1 })
  await json('users/me/video-quota-used', { videoQuotaUsedDaily: 0, videoQuotaUsed: 0 })
  await page.route(api('videos/upload-resumable*'), (route) => {
    const method = route.request().method()
    if (method === 'POST') {
      const name = /name="name"\r\n\r\n([^\r]*)/.exec(
        (route.request().postDataBuffer() ?? Buffer.alloc(0)).toString('utf8')
      )?.[1]
      const body = route.request().postData() ?? ''
      state.names.push(name ?? (/"name":"([^"]*)"/.exec(body)?.[1] || ''))
      return route.fulfill({
        status: 201,
        headers: {
          Location: `//${HOST}/api/v1/videos/upload-resumable?upload_id=up${state.names.length}`,
        },
        body: '',
      })
    }
    if (method === 'PUT') {
      if (state.failNext) {
        state.failNext = false
        return route.fulfill({ status: 422, body: '' })
      }
      const uuid = `chapter-${state.names.length}`
      return route.fulfill({
        json: { video: { id: state.names.length, uuid, shortUUID: uuid, isAudio: true } },
      })
    }
    return route.fulfill({ status: 204, body: '' })
  })
  return state
}

async function useWallet(page: Page): Promise<unknown[][]> {
  const sent: unknown[][] = []
  const rpc = (method: string) => new RegExp(`\\.pocketnet\\.app:8899/rpc(-ex)?/${method}`)
  const answer = (route: Route, data: unknown) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ headers: CORS, json: { result: 'success', data } })
  await page.route(rpc('txunspent'), (route) => {
    if (route.request().method() === 'OPTIONS') return answer(route, null)
    const [[address]] = route.request().postDataJSON().parameters as [[string]]
    return answer(route, [
      {
        txid: 'c'.repeat(64),
        vout: 0,
        address,
        amount: 1,
        amountSat: 100_000_000,
        confirmations: 120,
        scriptPubKey: p2pkhScript(address),
      },
    ])
  })
  await page.route(rpc('sendrawtransactionwithmessage'), (route) => {
    if (route.request().method() === 'OPTIONS') return answer(route, null)
    sent.push(route.request().postDataJSON().parameters as unknown[])
    return answer(route, 'f'.repeat(64))
  })
  return sent
}

const mp3 = (name: string) => ({ name, mimeType: 'audio/mpeg', buffer: MP3 })

test('окно поста: две записи по очереди, названия, порядок, сбой — и один аудио-пост в сеть', async ({
  page,
}) => {
  await useMockNode(page, { profiles: [ALICE, ME], posts: [], comments: [] })
  await useChapters(page)
  const server = await useUploads(page)
  const sent = await useWallet(page)
  await openApp(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Создать пост' }).first().click()
  const composer = page.getByRole('dialog', { name: 'Новый пост' })
  await expect(composer).toBeVisible()

  // Одна запись — без списка и без предупреждения.
  await composer.locator('input[type=file][accept^="video"]').setInputFiles([mp3('Глава 10.mp3')])
  const items = composer.getByTestId('composer-audio')
  await expect(items).toHaveCount(1)
  await expect(items.first()).toContainText('0:02', { timeout: 20_000 })
  await expect(composer.getByTestId('composer-audios-hint')).toHaveCount(0)
  await expect(composer.getByRole('textbox', { name: 'Название', exact: true })).toHaveValue(
    'Глава 10'
  )

  // Ещё две: вторая из них не загрузилась.
  await composer
    .getByTestId('composer-audio-add')
    .setInputFiles([mp3('Глава 2.mp3'), mp3('Глава 1.mp3')])
  await expect(items).toHaveCount(3)
  await expect(composer.getByTestId('composer-audios-hint')).toHaveText(
    'В прежнем Bastyon слышна только первая запись.'
  )
  await expect(items.locator('input')).toHaveCount(3)
  const titles = () =>
    items.locator('input').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))
  expect(await titles()).toEqual(['Глава 10', 'Глава 1', 'Глава 2'])
  await expect(items.nth(2)).toContainText('0:02', { timeout: 20_000 })
  expect(server.names).toEqual(['Глава 10', 'Глава 1', 'Глава 2'])

  server.failNext = true
  await composer.getByTestId('composer-audio-add').setInputFiles([mp3('Эпилог.mp3')])
  await expect(items.nth(3).getByRole('alert')).toBeVisible({ timeout: 20_000 })
  await expect(composer).toContainText('Одна из записей не загрузилась')

  // Порядок — стрелкой на ручке, название — в строке.
  await items
    .nth(0)
    .getByRole('button', { name: /^Переставить|Переместить|1/ })
    .first()
    .focus()
  await page.keyboard.press('ArrowDown')
  expect((await titles())[1]).toBe('Глава 10')
  await items.nth(1).getByRole('button').first().focus()
  await page.keyboard.press('ArrowDown')
  expect((await titles()).slice(0, 3)).toEqual(['Глава 1', 'Глава 2', 'Глава 10'])
  await items.nth(2).locator('input').fill('Глава 10. Финал')

  await composer.getByRole('textbox', { name: 'Название', exact: true }).fill('Моя книга')
  await composer.getByRole('textbox', { name: 'Добавьте теги…' }).fill('аудиокнига')
  const publish = composer.getByRole('button', { name: 'Опубликовать' })
  await expect(publish).toBeDisabled()
  await items.nth(3).getByRole('button', { name: 'Повторить' }).click()
  await expect(items.nth(3)).toContainText('0:02', { timeout: 20_000 })
  await composer.getByRole('button', { name: 'Убрать запись «Эпилог»' }).click()
  await expect(publish).toBeEnabled()
  await publish.click()

  await expect.poll(() => sent.length, { timeout: 30_000 }).toBe(1)
  const [, data, type] = sent[0] as [
    string,
    { u: string; c: string; s: { audios: unknown }; t: string[] },
    string,
  ]
  expect(type).toBe('audio')
  expect(data.c).toBe('Моя книга')
  expect(data.u).toBe(part(2))
  expect(data.s.audios).toEqual([
    { u: part(2), c: 'Глава 1', d: 2 },
    { u: part(3), c: 'Глава 2', d: 2 },
    { u: part(1), c: 'Глава 10. Финал', d: 2 },
  ])

  // Пост ждёт блока — книга видна автору сразу.
  await page.evaluate((path) => {
    const app = document.querySelector('#app') as unknown as {
      __vue_app__: { config: { globalProperties: { $router: { push(p: string): void } } } }
    }
    app.__vue_app__.config.globalProperties.$router.push(path)
  }, `/${ME.address}`)
  await expect(page.getByTestId('post-tx-pending').first()).toBeVisible()
  await expect(album(page).getByTestId('post-audio-row')).toHaveCount(3)
})

test('правка книги: записи на месте, последнюю не убрать', async ({ page }) => {
  const data = book(2)
  data.posts[0]!.address = ME.address
  await useMockNode(page, data)
  await useChapters(page)
  await openApp(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Изменить' }).first().click()
  const composer = page.getByRole('dialog').filter({ has: page.getByTestId('composer-audios') })
  const items = composer.getByTestId('composer-audio')
  await expect(items).toHaveCount(2)
  await composer.getByRole('button', { name: 'Убрать запись «Глава 2»' }).click()
  await expect(items).toHaveCount(1)
  await expect(composer.getByRole('button', { name: /^Убрать запись/ })).toHaveCount(0)
})
