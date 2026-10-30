import { createHash } from 'node:crypto'
import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, VIDEO_URL } from './support/mock-peertube'

/**
 * Разделы «Видео» и «Аудио», мини-плеер и коллекции на подменной ноде: сетка
 * роликов и окно поста с играющим роликом, вид «Постами», треки подряд в
 * мини-плеере, плейлист старого клиента (без
 * `contentTypes`) по своим элементам, ссылка `collection?c=` и новый плейлист
 * от кнопки «В плейлист» до транзакции `collection`. В сеть ничего не уходит.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const VIDEO_1 = '1'.repeat(64)
const VIDEO_2 = '2'.repeat(64)
const TRACK_1 = '3'.repeat(64)
const TRACK_2 = '4'.repeat(64)
const POST = '5'.repeat(64)
const ALBUM = '6'.repeat(64)

const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [
    {
      txid: VIDEO_1,
      address: ALICE.address,
      message: '',
      caption: 'Первый ролик',
      type: 'video',
      url: 'peertube://peertube101.pocketnet.app/aaaaaaaa-0000-0000-0000-000000000001',
    },
    {
      txid: VIDEO_2,
      address: ALICE.address,
      message: '',
      caption: 'Второй ролик',
      type: 'video',
      url: 'peertube://peertube101.pocketnet.app/aaaaaaaa-0000-0000-0000-000000000002',
    },
    {
      txid: TRACK_1,
      address: ALICE.address,
      message: '',
      caption: 'Первая песня',
      type: 'audio',
      url: 'peertube://peertube101.pocketnet.app/bbbbbbbb-0000-0000-0000-000000000001/audio',
    },
    {
      txid: TRACK_2,
      address: ALICE.address,
      message: '',
      caption: 'Вторая песня',
      type: 'audio',
      url: 'peertube://peertube101.pocketnet.app/bbbbbbbb-0000-0000-0000-000000000002/audio',
    },
    { txid: POST, address: ALICE.address, message: 'Просто пост', type: 'share' },
  ],
  comments: [],
  collections: [
    // Альбом из старого клиента: типа нет, элементы — аудио.
    {
      txid: ALBUM,
      address: ALICE.address,
      caption: 'Мой альбом',
      contentIds: [TRACK_1, TRACK_2],
      description: 'Две песни',
    },
  ],
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const hash256 = (text: string): string =>
  createHash('sha256').update(createHash('sha256').update(text).digest()).digest('hex')

/** Второй push OP_RETURN транзакции — hash256 строки сериализации. */
function opReturnHash(hex: string): string | null {
  const m = /6a0a636f6c6c656374696f6e20([0-9a-f]{64})/.exec(hex)
  return m ? m[1]! : null
}

async function useWallet(page: Page): Promise<{ sent: unknown[][] }> {
  const state = { sent: [] as unknown[][] }
  const rpc = (method: string) => new RegExp(`\\.pocketnet\\.app:8899/rpc(-ex)?/${method}`)
  const answer = (route: Route, data: unknown) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ headers: CORS, json: { result: 'success', data } })
  const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const p2pkh = (address: string): string => {
    let n = 0n
    for (const c of address) n = n * 58n + BigInt(BASE58.indexOf(c))
    return `76a914${n.toString(16).padStart(50, '0').slice(2, 42)}88ac`
  }
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
        scriptPubKey: p2pkh(address),
      },
    ])
  })
  await page.route(rpc('sendrawtransactionwithmessage'), (route) => {
    if (route.request().method() === 'OPTIONS') return answer(route, null)
    state.sent.push(route.request().postDataJSON().parameters as unknown[])
    return answer(route, 'f'.repeat(64))
  })
  return state
}

/** Открыть страницу; на чистом профиле сначала закрыть «Что нового». */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path)
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

test('раздел «Видео»: только ролики, сеткой', async ({ page }) => {
  await useMockNode(page, DATA)
  await open(page, '/video')
  const grid = page.getByTestId('video-grid')
  await expect(grid.getByTestId('video-card')).toHaveCount(2)
  await expect(grid).toContainText('Первый ролик')
  await expect(grid).not.toContainText('Первая песня')
  // Прежняя ссылка на режим ленты ведёт в раздел.
  await page.goto('/?feedMode=audio')
  await expect(page).toHaveURL(/\/audio$/)
})

test('раздел «Видео»: ролик играет в окне поста с текстом', async ({ page }) => {
  test.setTimeout(60_000)
  await useMockNode(page, {
    ...DATA,
    posts: DATA.posts.map((p) =>
      p.txid === VIDEO_1 ? { ...p, url: VIDEO_URL, message: 'Описание ролика' } : p
    ),
  })
  await useMockPeerTube(page)
  await open(page, '/video')
  const card = page.getByTestId('video-card').filter({ hasText: 'Первый ролик' })
  await card.getByRole('link', { name: 'Первый ролик' }).first().click()

  const modal = page.locator('.ant-modal-content')
  await expect(modal).toContainText('Описание ролика')
  const video = modal.locator('video').first()
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime).catch(() => 0), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0.5)
  // Окно поверх раздела: адрес и сетка на месте.
  await expect(page).toHaveURL(/\/video$/)
  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
  await expect(page.getByTestId('video-grid')).toBeVisible()
})

test('вид «Постами»: у «Видео» и «Аудио» свой, запоминается', async ({ page }) => {
  await useMockNode(page, DATA)
  await open(page, '/video')
  await expect(page.getByTestId('video-card')).toHaveCount(2)
  await page.getByTestId('media-view-switch').getByRole('button', { name: 'Постами' }).click()
  const posts = page.getByTestId('media-post-list').getByTestId('post-media')
  await expect(posts).toHaveCount(2)
  await expect(page.getByTestId('video-grid')).toHaveCount(0)
  await expect(page.getByTestId('media-post-list')).not.toContainText('Первая песня')

  await page.reload()
  await expect(page.getByTestId('media-post-list').getByTestId('post-media')).toHaveCount(2)

  // У «Аудио» вид свой: там по-прежнему список треков.
  await page.goto('/audio')
  await expect(page.getByTestId('track-row')).toHaveCount(2)
  await page.getByTestId('media-view-switch').getByRole('button', { name: 'Постами' }).click()
  await expect(page.getByTestId('media-post-list')).toContainText('Вторая песня')
  await expect(page.getByTestId('track-row')).toHaveCount(0)
  await page
    .getByTestId('media-view-switch')
    .getByRole('button', { name: 'Списком треков' })
    .click()
  await expect(page.getByTestId('track-row')).toHaveCount(2)
})

// Посты раздела — шириной страницы, как сетка: кнопка ширины в шапке сужает и
// растягивает их. Раньше колонка стояла на 720 px при любой ширине.
test('вид «Постами» следует кнопке ширины в шапке', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await useMockNode(page, DATA)
  await open(page, '/video')
  await page.getByTestId('media-view-switch').getByRole('button', { name: 'Постами' }).click()
  const list = page.getByTestId('media-post-list')
  await expect(list.getByTestId('post-media')).toHaveCount(2)
  const width = async () => Math.round((await list.boundingBox())!.width)

  const full = await width()
  expect(full).toBeGreaterThan(1500)
  await page.getByRole('button', { name: 'Ограничить ширину' }).click()
  await expect.poll(width).toBeLessThan(1280)
  await page.getByRole('button', { name: 'Во всю ширину' }).click()
  await expect.poll(width).toBe(full)
})

test('раздел «Аудио»: трек в мини-плеере, следующий, плеер живёт при переходах', async ({
  page,
}) => {
  await useMockNode(page, DATA)
  await open(page, '/audio')
  const rows = page.getByTestId('track-row')
  await expect(rows).toHaveCount(2)
  await rows.first().getByRole('button').first().click()
  const player = page.getByTestId('mini-player')
  await expect(player).toContainText('Первая песня')
  await player.getByRole('button', { name: 'Следующий' }).click()
  await expect(player).toContainText('Вторая песня')
  await page.getByRole('button', { name: 'Очередь' }).click()
  await expect(page.getByTestId('mini-player-queue')).toContainText('Первая песня')
  // Переход по приложению (без перезагрузки) плеер не закрывает.
  await rows.first().getByRole('link', { name: ALICE.name }).click()
  await expect(page).toHaveURL(new RegExp(ALICE.name))
  await expect(page.getByTestId('mini-player')).toContainText('Вторая песня')
  await page.getByRole('button', { name: 'Закрыть плеер' }).click()
  await expect(page.getByTestId('mini-player')).toBeHidden()
})

test('плейлист старого клиента: тип по элементам, «Воспроизвести все», ссылка collection?c=', async ({
  page,
}) => {
  await useMockNode(page, DATA)
  await open(page, `/collection?c=${ALBUM}`)
  await expect(page).toHaveURL(new RegExp(`/collection/${ALBUM}$`))
  await expect(page.getByText('Аудиоплейлист')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Мой альбом' })).toBeVisible()
  await expect(page.getByTestId('track-row')).toHaveCount(2)
  await page.getByTestId('play-all').click()
  await expect(page.getByTestId('mini-player')).toContainText('Первая песня')
  // Профиль: альбом — на вкладке «Аудио».
  await page.goto(`/${ALICE.address}?tab=audio`)
  await expect(page.getByTestId('collection-card')).toContainText('Мой альбом')
})

test('новый плейлист из-под ролика: транзакция collection с типом 201 и верным хешем', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await useMockNode(page, DATA)
  const wallet = await useWallet(page)
  await open(page, `/post/${VIDEO_1}`)
  await signIn(page)
  await page.getByTestId('post-add-to-list').first().click()
  const list = page.getByTestId('add-to-list')
  await expect(list).toBeVisible()
  await list.getByRole('button', { name: 'Новый плейлист' }).click()
  const editor = page.getByTestId('collection-editor')
  await expect(editor).toContainText('Первый ролик')
  await page.getByTestId('collection-caption').fill('Сезон 1')
  await page.getByTestId('collection-save').click()
  await expect.poll(() => wallet.sent.length, { timeout: 30_000 }).toBe(1)
  const [hex, payload, operation] = wallet.sent[0] as [string, Record<string, unknown>, string]
  expect(operation).toBe('collection')
  expect(payload).toMatchObject({
    c: 'Сезон 1',
    contentIds: [VIDEO_1],
    contentTypes: 201,
    txidEdit: '',
  })
  const serialized = `201${VIDEO_1}${payload.l}${payload.c}${payload.i}${payload.s}`
  expect(opReturnHash(hex)).toBe(hash256(serialized))
  // Новый плейлист открывается сразу, с пометкой «Публикуется».
  await expect(page.getByRole('heading', { name: 'Сезон 1' })).toBeVisible()
  await expect(page.getByText('Публикуется')).toBeVisible()
})
