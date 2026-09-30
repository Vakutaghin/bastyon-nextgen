import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import {
  useMockPeerTube,
  PEERTUBE_HOST,
  VIDEO_ID,
  type MockPeerTubeOptions,
} from './support/mock-peertube'

/**
 * Откуда плеер берёт ролик, когда что-то сломано: нода из ссылки поста
 * выведена из работы, HLS не отдаёт куски с самого начала или обрывается
 * посреди просмотра. Во всех случаях ролик должен играть, а не показывать
 * ошибку.
 */

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }

function nodeData(url: string): MockNodeData {
  return {
    profiles: [ALICE],
    posts: [
      {
        txid: 'e'.repeat(64),
        address: ALICE.address,
        message: 'Ролик для проверки источников',
        type: 'video',
        url,
      },
    ],
    comments: [],
  }
}

async function open(page: Page, options: MockPeerTubeOptions = {}) {
  const linkHost = options.linkHost ?? PEERTUBE_HOST
  await useMockNode(page, nodeData(`peertube://${linkHost}/${VIDEO_ID}`))
  const mock = await useMockPeerTube(page, options)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  // Чистый профиль — первый запуск: «Что нового» перекрывает страницу.
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  return mock
}

const video = (page: Page) => page.locator('video').first()
const state = (page: Page) =>
  video(page).evaluate((v: HTMLVideoElement) => ({
    time: v.currentTime,
    paused: v.paused,
    src: v.currentSrc,
  }))

async function play(page: Page) {
  const button = page.getByRole('button', { name: 'Смотреть', exact: true })
  await button.waitFor({ timeout: 20_000 })
  await button.scrollIntoViewIfNeeded()
  await button.click()
}

test.describe('Нода из ссылки не отвечает', () => {
  test('ролик с выведенной из работы ноды играет из архива', async ({ page }) => {
    await open(page, {
      linkHost: 'peertube3501.pocketnet.app',
      servedBy: 'peertube.archive.pocketnet.app',
    })
    const poster = page.locator('img[src*="/static/thumbnails/"]').first()
    await expect(poster).toHaveAttribute('src', /peertube\.archive\.pocketnet\.app/)
    await play(page)
    await expect
      .poll(async () => (await state(page)).time, { timeout: 15_000 })
      .toBeGreaterThan(0.5)
    expect((await state(page)).src).toContain('peertube.archive.pocketnet.app')
  })

  test('ноды нет в списке архивов — ролик находит прокси Bastyon', async ({ page }) => {
    await open(page, { linkHost: 'gone.e2e.test', servedBy: PEERTUBE_HOST, onlyProxyKnows: true })
    await play(page)
    await expect
      .poll(async () => (await state(page)).time, { timeout: 20_000 })
      .toBeGreaterThan(0.5)
    expect((await state(page)).src).toContain(PEERTUBE_HOST)
  })
})

test.describe('HLS', () => {
  test('играет через HLS, прямой mp4 не нужен', async ({ page }) => {
    const mock = await open(page, { hls: true })
    await play(page)
    await expect
      .poll(async () => (await state(page)).time, { timeout: 15_000 })
      .toBeGreaterThan(0.5)
    expect((await state(page)).src).toMatch(/^blob:/)
    expect(mock.requests.hls).toBeGreaterThan(0)
    expect(mock.requests.mp4).toBe(0)
  })

  test('куски HLS не грузятся — ролик играет из mp4', async ({ page }) => {
    const mock = await open(page, { hls: true, hlsBreaksAfter: 0 })
    await play(page)
    await expect
      .poll(async () => (await state(page)).time, { timeout: 20_000 })
      .toBeGreaterThan(0.5)
    expect((await state(page)).src).toContain('/static/web-videos/')
    expect(mock.requests.mp4).toBeGreaterThan(0)
  })

  test('HLS оборвался посреди ролика — mp4 продолжает с того же места', async ({ page }) => {
    // Инициализация и два куска по 2 секунды, дальше нода молчит.
    await open(page, { hls: true, hlsBreaksAfter: 3 })
    await play(page)
    await expect.poll(async () => (await state(page)).time, { timeout: 15_000 }).toBeGreaterThan(2)
    // Каждое время, которое показал уже mp4 (после его метаданных): начни он с
    // нуля, здесь окажутся доли секунды.
    await video(page).evaluate((v: HTMLVideoElement) => {
      const times: number[] = []
      ;(window as unknown as { mp4Times: number[] }).mp4Times = times
      v.addEventListener('timeupdate', () => {
        if (v.readyState >= 1 && v.currentSrc.includes('/static/web-videos/')) {
          times.push(v.currentTime)
        }
      })
    })
    const mp4Times = () =>
      page.evaluate(() => (window as unknown as { mp4Times: number[] }).mp4Times)
    await expect.poll(async () => (await mp4Times()).length, { timeout: 30_000 }).toBeGreaterThan(3)
    const times = await mp4Times()
    expect(Math.min(...times)).toBeGreaterThan(2)
    expect(Math.max(...times)).toBeGreaterThan(Math.min(...times))
  })
})

test.describe('Нативный HLS, как на iPhone без MediaSource', () => {
  test.skip(({ browserName }) => browserName !== 'webkit', 'плейлист сам играет только WebKit')
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Без MediaSource hls.js не работает, и плеер отдаёт плейлист самому <video>.
      const w = window as unknown as Record<string, unknown>
      delete w.MediaSource
      delete w.ManagedMediaSource
      delete w.WebKitMediaSource
    })
  })

  test('плейлист играет сам <video>', async ({ page }) => {
    await open(page, { hls: true })
    await play(page)
    await expect
      .poll(async () => (await state(page)).time, { timeout: 15_000 })
      .toBeGreaterThan(0.5)
    expect((await state(page)).src).toContain('master.m3u8')
  })

  test('куски не грузятся — ролик играет из mp4', async ({ page }) => {
    // Safari тут ошибки не шлёт, ролик просто стоит: плеер ждёт 15 секунд.
    test.setTimeout(60_000)
    await open(page, { hls: true, hlsBreaksAfter: 0 })
    await play(page)
    await expect
      .poll(async () => (await state(page)).src, { timeout: 30_000 })
      .toContain('/static/web-videos/')
    await expect
      .poll(async () => (await state(page)).time, { timeout: 15_000 })
      .toBeGreaterThan(0.5)
  })
})
