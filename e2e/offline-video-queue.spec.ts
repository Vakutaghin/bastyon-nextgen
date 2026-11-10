import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, PEERTUBE_HOST, VIDEO_ID, VIDEO_URL } from './support/mock-peertube'

/**
 * Очередь скачанных роликов в вебе (воркер и OPFS) посреди загрузки: пауза и
 * «Продолжить», «Повторить» после ответа «файла нет», докачка сама после
 * перезагрузки вкладки, две вкладки на один ролик. Субтитры скачиваются с
 * роликом и показываются без сети; «Удалить всё» в настройках стирает папки.
 * Файл ролика придерживается маршрутом, пока тест не отпустит, — так
 * загрузка «идёт» сколько нужно. Подменные нода и PeerTube; OPFS — только у
 * Chromium (профиль WebKit у Playwright эфемерный).
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const VIDEO = '1'.repeat(64)
const FILE = `https://${PEERTUBE_HOST}/static/streaming-playlists/hls/${VIDEO_ID}/test-video-240-fragmented.mp4`
const VTT = ['WEBVTT', '', '00:00:00.000 --> 00:00:30.000', 'Реплика с диска', ''].join('\n')

const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [
    {
      txid: VIDEO,
      address: ALICE.address,
      message: 'Описание ролика',
      caption: 'Ролик для дороги',
      type: 'video',
      url: VIDEO_URL,
    },
  ],
  comments: [],
}

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'OPFS в эфемерном профиле WebKit недоступна')
  test.setTimeout(120_000)
})

/** Файл ролика: держать запросы, отвечать ошибкой или отдавать как обычно. */
async function holdFile(page: Page) {
  const gate = { open: false, status: 200, held: [] as Route[], asked: 0 }
  await page.route(FILE, async (route) => {
    gate.asked++
    if (gate.status !== 200) return route.fulfill({ status: gate.status, body: '' })
    if (!gate.open) {
      gate.held.push(route)
      return
    }
    return route.fallback()
  })
  return {
    gate,
    /** Отпустить придержанные и дальше отдавать сразу. */
    async release() {
      gate.open = true
      for (const route of gate.held.splice(0)) await route.fallback().catch(() => {})
    },
  }
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

/** Переход внутри приложения — без перезагрузки: загрузка в воркере не обрывается. */
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

/** С поста: «Скачать» → 240p. */
async function download(page: Page): Promise<void> {
  await page.getByTestId('offline-download').first().click()
  await page.getByTestId('offline-quality-240').click()
}

test('пауза посреди загрузки, «Продолжить» докачивает; субтитры — с диска; «Удалить всё»', async ({
  page,
}) => {
  await useMockNode(page, DATA)
  await useMockPeerTube(page, {
    hls: true,
    captions: [{ language: 'ru', label: 'Русский', vtt: VTT }],
  })
  const file = await holdFile(page)
  await open(page, `/post/${VIDEO}`)
  await signIn(page)
  await download(page)
  await expect.poll(() => file.gate.held.length, { timeout: 30_000 }).toBeGreaterThan(0)

  await goTo(page, '/video/downloads')
  const card = page.getByTestId('offline-card')
  await expect(card).toHaveAttribute('data-status', 'downloading')
  await card.getByRole('button', { name: 'Приостановить' }).click()
  await expect(card).toHaveAttribute('data-status', 'paused')
  await expect(card).toContainText('Пауза')

  await file.release()
  await card.getByRole('button', { name: 'Продолжить' }).click()
  await expect(card).toHaveAttribute('data-status', 'done', { timeout: 60_000 })

  // Сеть пропала — субтитры читаются из папки ролика.
  await page.route('https://video.e2e.test/**', (route) => route.abort('internetdisconnected'))
  await page.route('**/api/peertube/**', (route) => route.abort('internetdisconnected'))
  await card.click()
  const player = page.getByTestId('offline-player')
  const track = player.locator('video track')
  await expect(track).toHaveCount(1, { timeout: 20_000 })
  await expect(track).toHaveAttribute('label', 'Русский')
  await expect(track).toHaveAttribute('src', /^blob:/)
  const cue = await player.locator('video').evaluate(async (v: HTMLVideoElement) => {
    const t = v.textTracks[0]!
    t.mode = 'hidden'
    for (let i = 0; i < 50 && !(t.cues && t.cues.length); i++) {
      await new Promise((r) => setTimeout(r, 100))
    }
    return (t.cues?.[0] as VTTCue | undefined)?.text ?? null
  })
  expect(cue).toBe('Реплика с диска')
  await page.locator('.ant-modal-close').click()
  await expect(player).toBeHidden()

  // Настройки: сколько занято, «Удалить всё» — и в «Скачанном» пусто.
  await goTo(page, '/settings?tab=system')
  const row = page.getByTestId('offline-videos-settings')
  await expect(row).toContainText(/Занято: \d/, { timeout: 20_000 })
  await row.getByRole('button', { name: 'Удалить всё' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить всё' }).click()
  await goTo(page, '/video/downloads')
  await expect(page.getByTestId('offline-downloads')).toContainText('Скачанных роликов нет')
})

test('файла нет на сервере — «Не скачалось», «Повторить» докачивает', async ({ page }) => {
  await useMockNode(page, DATA)
  await useMockPeerTube(page, { hls: true })
  const file = await holdFile(page)
  file.gate.status = 404
  await open(page, `/post/${VIDEO}`)
  await signIn(page)
  await download(page)

  await goTo(page, '/video/downloads')
  const card = page.getByTestId('offline-card')
  await expect(card).toHaveAttribute('data-status', 'failed', { timeout: 30_000 })
  await expect(card).toContainText('файла нет на серверах')

  file.gate.status = 200
  file.gate.open = true
  await card.getByRole('button', { name: 'Повторить' }).click()
  await expect(card).toHaveAttribute('data-status', 'done', { timeout: 60_000 })
})

test('«Отменить загрузку» посреди загрузки — карточка и папка ролика пропадают', async ({
  page,
}) => {
  await useMockNode(page, DATA)
  await useMockPeerTube(page, { hls: true })
  const file = await holdFile(page)
  await open(page, `/post/${VIDEO}`)
  await signIn(page)
  await download(page)
  await expect.poll(() => file.gate.held.length, { timeout: 30_000 }).toBeGreaterThan(0)

  await goTo(page, '/video/downloads')
  const card = page.getByTestId('offline-card')
  await expect(card).toHaveAttribute('data-status', 'downloading')
  await card.getByRole('button', { name: 'Отменить загрузку' }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByTestId('offline-downloads')).toContainText('Скачанных роликов нет')
  // Папку стирает сама остановленная загрузка — на диске пусто.
  const folders = () =>
    page.evaluate(async () => {
      const root = await navigator.storage.getDirectory()
      const offline = await root.getDirectoryHandle('offline').catch(() => null)
      const names: string[] = []
      if (offline) {
        for await (const key of (offline as unknown as { keys(): AsyncIterable<string> }).keys()) {
          names.push(key)
        }
      }
      return names
    })
  await expect.poll(folders).toEqual([])
})

test('вкладку перезагрузили посреди загрузки — ролик докачивается сам', async ({ page }) => {
  await useMockNode(page, DATA)
  await useMockPeerTube(page, { hls: true })
  const file = await holdFile(page)
  await open(page, `/post/${VIDEO}`)
  await signIn(page)
  await download(page)
  await expect.poll(() => file.gate.held.length, { timeout: 30_000 }).toBeGreaterThan(0)

  // Вкладку закрыли: воркер умер посреди загрузки. Открыли снова — без нажатий.
  file.gate.open = true
  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await goTo(page, '/video/downloads')
  const card = page.getByTestId('offline-card')
  await expect(card).toHaveCount(1, { timeout: 20_000 })
  await expect(card).toHaveAttribute('data-status', 'done', { timeout: 60_000 })
})

test('две вкладки: вторая не качает тот же ролик, а ждёт первую и показывает итог', async ({
  page,
  context,
}) => {
  await useMockNode(page, DATA)
  await useMockPeerTube(page, { hls: true })
  const file = await holdFile(page)
  await open(page, `/post/${VIDEO}`)
  await signIn(page)
  await download(page)
  await expect.poll(() => file.gate.held.length, { timeout: 30_000 }).toBeGreaterThan(0)

  const second = await context.newPage()
  await useMockPeerTube(second, { hls: true })
  const secondFile = await holdFile(second)
  secondFile.gate.open = true
  await open(second, '/video/downloads')
  const card = second.getByTestId('offline-card')
  await expect(card).toHaveCount(1, { timeout: 20_000 })
  await expect(card).toHaveAttribute('data-status', /downloading|queued/)
  // Вторая вкладка за файл не берётся: его держит первая.
  await second.waitForTimeout(4_000)
  expect(secondFile.gate.asked).toBe(0)
  // «Отменить» там, где ролик не качается, загрузку первой не ломает.
  await card.getByRole('button', { name: 'Отменить загрузку' }).click()
  await second.waitForTimeout(1_000)
  await expect(card).toHaveCount(1)

  // Первая докачала — вторая видит готовый ролик сама.
  await file.release()
  await expect(card).toHaveAttribute('data-status', 'done', { timeout: 60_000 })
  expect(secondFile.gate.asked).toBe(0)
  await goTo(page, '/video/downloads')
  await expect(page.getByTestId('offline-card')).toHaveAttribute('data-status', 'done')
})
