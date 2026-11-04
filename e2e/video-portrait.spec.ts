import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, VIDEO_URL, type MockPeerTubeOptions } from './support/mock-peertube'

/**
 * Вертикальный ролик в ленте — вертикальной рамкой: раньше рамка всегда была
 * 16:9, и ролик выходил узкой полосой посередине. Пропорции известны до
 * запуска (описание на сервере, у старых роликов — обложка). На телефоне
 * рамка во всю ширину, на компьютере — не выше 600 px. Горизонтальный — как был.
 */

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [
    {
      txid: 'e'.repeat(64),
      address: ALICE.address,
      message: 'Вертикальный ролик',
      type: 'video',
      url: VIDEO_URL,
    },
  ],
  comments: [],
}

async function open(page: Page, options: MockPeerTubeOptions) {
  await useMockNode(page, DATA)
  await useMockPeerTube(page, options)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Смотреть', exact: true }).waitFor({ timeout: 20_000 })
}

/** Рамка плеера: обёртка над обёрткой `<video>`. */
const frame = (page: Page) => page.locator('video').first().locator('xpath=../..')

async function frameBox(page: Page) {
  const box = (await frame(page).boundingBox())!
  return { ...box, ratio: box.width / box.height }
}

test('телефон: вертикальный ролик во всю ширину, обложка без полос', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, { portrait: true })

  await expect
    .poll(async () => (await frameBox(page)).ratio, { timeout: 15_000 })
    .toBeCloseTo(0.5625, 2)
  const box = await frameBox(page)
  const post = (await page.getByTestId('post-media').first().boundingBox())!
  expect(box.width).toBeGreaterThan(post.width - 2)
  // И весь на экране: между шапкой и нижней панелью разделов.
  const nav = (await page.getByRole('navigation').last().boundingBox())!
  expect(box.height).toBeLessThan(nav.y - 48)

  // Обложка заполняет рамку целиком.
  const poster = page.locator('img[src*="/static/thumbnails/"]').last()
  await expect(poster).toBeVisible()
  const posterBox = (await poster.boundingBox())!
  expect(Math.abs(posterBox.width - box.width)).toBeLessThan(2)
  expect(Math.abs(posterBox.height - box.height)).toBeLessThan(2)

  // Запустили — рамка та же, ролик её заполняет.
  await page.getByRole('button', { name: 'Смотреть', exact: true }).click()
  await expect
    .poll(
      () =>
        page
          .locator('video')
          .first()
          .evaluate((v: HTMLVideoElement) => v.videoHeight),
      {
        timeout: 15_000,
      }
    )
    .toBe(256)
  expect((await frameBox(page)).ratio).toBeCloseTo(0.5625, 2)
})

test('старый ролик без пропорций в описании — рамка по обложке', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, { portrait: true, noAspectRatio: true })
  await expect
    .poll(async () => (await frameBox(page)).ratio, { timeout: 15_000 })
    .toBeCloseTo(0.5625, 2)
})

test('компьютер: вертикальный не выше 600 px, горизонтальный — как был', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1400, height: 1000 })
  await open(page, { portrait: true })
  await expect
    .poll(async () => (await frameBox(page)).ratio, { timeout: 15_000 })
    .toBeCloseTo(0.5625, 2)
  expect((await frameBox(page)).height).toBeLessThanOrEqual(601)
})

test('горизонтальный ролик — рамка по-прежнему по ширине ленты', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, {})
  await expect
    .poll(async () => (await frameBox(page)).ratio, { timeout: 15_000 })
    .toBeCloseTo(1.775, 1)
  const post = (await page.getByTestId('post-media').first().boundingBox())!
  expect((await frameBox(page)).width).toBeGreaterThan(post.width - 2)
})

test('раздел «Видео»: обложка вертикального ролика целиком', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await useMockNode(page, DATA)
  await useMockPeerTube(page, { portrait: true })
  // Обложки карточек — из кэша ноды (`peertube/videos`), не с видеосервера.
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
  await page.route(/\.pocketnet\.app:8899\/peertube\/videos/, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({
          headers: cors,
          json: {
            result: 'success',
            data: {
              [VIDEO_URL]: { thumbnailPath: '/static/thumbnails/e2e-video.jpg', duration: 6 },
            },
          },
        })
  )
  await page.goto('/video')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  const thumb = page.getByTestId('video-card').first().locator('a').first()
  await expect(thumb).toHaveClass(/portrait/, { timeout: 20_000 })
  expect(await thumb.locator('img').evaluate((img) => getComputedStyle(img).objectFit)).toBe(
    'contain'
  )
})
