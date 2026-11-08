import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, VIDEO_URL } from './support/mock-peertube'

/**
 * Скачать ролик для просмотра без сети (веб: воркер и OPFS) на подменной
 * ноде и подменном PeerTube: «Скачать» под роликом → лист качества →
 * «Скачано» → сеть пропала → «Скачанное» → ролик играет с диска и
 * перематывается → «Удалить загрузку». В сеть ничего не уходит.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const VIDEO = '1'.repeat(64)

const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [
    {
      txid: VIDEO,
      address: ALICE.address,
      message: 'Описание ролика 0:10 Вторая глава',
      caption: 'Ролик для дороги',
      type: 'video',
      url: VIDEO_URL,
    },
  ],
  comments: [],
}

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

/** Переход внутри приложения — без перезагрузки (сети уже нет). */
async function goTo(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    const el = document.querySelector('#app') as unknown as {
      __vue_app__: {
        config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
      }
    }
    return el.__vue_app__.config.globalProperties.$router.push(to)
  }, path)
}

test('скачать ролик → без сети он играет, перематывается и удаляется', async ({
  page,
  browserName,
}) => {
  // Профиль WebKit у Playwright эфемерный: OPFS там, как в приватном окне
  // Safari, отвечает UnknownError.
  test.skip(browserName !== 'chromium', 'OPFS в эфемерном профиле WebKit недоступна')
  test.setTimeout(120_000)
  await useMockNode(page, DATA)
  const peertube = await useMockPeerTube(page, { hls: true })
  await open(page, `/post/${VIDEO}`)
  await signIn(page)

  const button = page.getByTestId('offline-download').first()
  await button.click()
  await page.getByTestId('offline-quality-240').click()
  await expect(button).toHaveAttribute('data-status', 'done', { timeout: 60_000 })
  await expect(button).toContainText('Скачано')
  const fetched = peertube.requests.hls

  // Сеть пропала: PeerTube больше не отвечает, всё дальше — с диска. Сам
  // dev-сервер остаётся: модули страниц он отдаёт лениво, а в приложении и
  // сборке они и так на устройстве.
  await page.route('https://video.e2e.test/**', (route) => route.abort('internetdisconnected'))
  await page.route('**/api/peertube/**', (route) => route.abort('internetdisconnected'))
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    window.dispatchEvent(new Event('offline'))
  })
  await goTo(page, '/video/downloads')
  await expect(page.getByTestId('offline-banner')).toBeVisible()
  const card = page.getByTestId('offline-card')
  await expect(card).toHaveCount(1)
  await expect(card).toHaveAttribute('data-status', 'done')
  await expect(card).toContainText('Ролик для дороги')

  await card.click()
  const player = page.getByTestId('offline-player')
  await expect(player).toContainText('Описание ролика')
  const video = player.locator('video').first()
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentSrc), { timeout: 20_000 })
    .toMatch(/^blob:/)
  await video.evaluate((v: HTMLVideoElement) => {
    v.muted = true
    void v.play().catch(() => {})
  })
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 })
    .toBeGreaterThan(0.3)
  // Перемотка — по файлу с диска, без сети.
  await video.evaluate(
    (v: HTMLVideoElement) =>
      new Promise<void>((resolve) => {
        v.addEventListener('seeked', () => resolve(), { once: true })
        v.currentTime = 20
      })
  )
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(19.5)
  expect(peertube.requests.hls).toBe(fetched)

  await page.keyboard.press('Escape')
  await expect(player).toBeHidden()
  await card.getByTestId('offline-remove').click()
  await expect(card).toHaveCount(0)
  await expect(page.getByTestId('offline-downloads')).toContainText('Скачанных роликов нет')
})

test('«Скачать всё» у плейлиста: одно качество на всех, недоступный ролик — пропуск с объяснением', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'OPFS в эфемерном профиле WebKit недоступна')
  test.setTimeout(120_000)
  const DEAD = '2'.repeat(64)
  const PLAYLIST = '3'.repeat(64)
  await useMockNode(page, {
    ...DATA,
    posts: [
      ...DATA.posts,
      {
        txid: DEAD,
        address: ALICE.address,
        message: 'Ролик на выключенном сервере',
        caption: 'Недоступный ролик',
        type: 'video',
        url: 'peertube://dead.e2e.test/gone',
      },
    ],
    collections: [
      {
        txid: PLAYLIST,
        address: ALICE.address,
        caption: 'В дорогу',
        contentIds: [VIDEO, DEAD],
        contentTypes: 201,
      },
    ],
  })
  await useMockPeerTube(page, { hls: true })
  await open(page, `/collection/${PLAYLIST}`)
  await signIn(page)

  const all = page.getByTestId('offline-download-all')
  await expect(all).toHaveText('Скачать всё', { timeout: 30_000 })
  await all.click()
  const sheet = page.getByRole('dialog', { name: 'Качество для 1 ролика' })
  await expect(sheet).toBeVisible({ timeout: 30_000 })
  await sheet.getByTestId('offline-quality-240').click()
  await expect(page.getByText('В «Скачанном» 1 ролик')).toBeVisible()
  await expect(page.getByText(/Ещё 1 пока не скачать/)).toBeVisible()

  await goTo(page, '/video/downloads')
  const card = page.getByTestId('offline-card')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('Ролик для дороги')
  await expect(card).toHaveAttribute('data-status', 'done', { timeout: 60_000 })
})

test('профиль без OPFS (приватное окно Safari): «Скачать» честно говорит, что здесь нельзя', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'webkit', 'эфемерный профиль без OPFS — у WebKit')
  test.setTimeout(90_000)
  await useMockNode(page, DATA)
  await useMockPeerTube(page, { hls: true })
  await open(page, `/post/${VIDEO}`)
  await signIn(page)
  await page.getByTestId('offline-download').first().click()
  await expect(page.locator('.ant-notification')).toContainText('Здесь скачивать нельзя')
  await expect(page.getByTestId('offline-quality-sheet')).toHaveCount(0)
})

test('аудио из ленты: файл звука качается, «Загрузки» в шапке, «Сохранить файлом»', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'OPFS в эфемерном профиле WebKit недоступна')
  test.setTimeout(120_000)
  const TRACK = '4'.repeat(64)
  await useMockNode(page, {
    profiles: [ALICE],
    posts: [
      {
        txid: TRACK,
        address: ALICE.address,
        message: 'Трек для дороги',
        caption: 'Трек для дороги',
        type: 'audio',
        url: VIDEO_URL,
      },
    ],
    comments: [],
  })
  // У аудио PeerTube один файл с разрешением 0 — раньше скачивание отвечало
  // «ещё обрабатывается» навсегда.
  await useMockPeerTube(page, { hls: true, audioOnly: true })
  // Без диалога сохранения файл уходит обычной загрузкой браузера.
  await page.addInitScript(() => {
    delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker
  })
  await open(page, '/')
  await signIn(page)

  // «Скачать» — прямо в ленте; качество у звука не спрашивается.
  const card = page.locator('.post-card', { hasText: 'Трек для дороги' })
  const button = card.getByTestId('offline-download')
  await button.click({ timeout: 30_000 })
  await expect(button).toHaveAttribute('data-status', 'done', { timeout: 60_000 })
  await expect(page.locator('.ant-notification')).toContainText('Скачано: «Трек для дороги»')

  // Шапка: значок «Загрузки» с историей, «Сохранить файлом» — обычный файл .m4a.
  await page.getByTestId('header-downloads').click()
  const row = page.getByTestId('header-download')
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute('data-status', 'done')
  await expect(row).toContainText('Трек для дороги')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    row.getByTestId('header-download-save').click(),
  ])
  expect(download.suggestedFilename()).toBe('Трек для дороги.m4a')
  expect((await download.createReadStream()).readableLength >= 0).toBe(true)
  await expect(page.locator('.ant-notification')).toContainText('Сохранено: Трек для дороги.m4a')

  // «Всё скачанное» — вкладка «Скачанное» раздела «Аудио».
  await page.getByTestId('header-downloads-all').click()
  await expect(page).toHaveURL(/\/audio\/downloads$/)
  await expect(page.getByTestId('offline-card')).toContainText('Трек для дороги')
})
