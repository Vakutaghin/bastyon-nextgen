import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, VIDEO_URL } from './support/mock-peertube'

/**
 * Плеер как у YouTube, на подменных ноде и PeerTube (ролик 30 секунд из
 * e2e/fixtures). Мышь: клик — пауза, стрелка — на 5 секунд, цифра — к доле
 * ролика, скорость — из меню. Палец: касание показывает панель, а не ставит
 * на паузу, двойное касание справа — вперёд на 10 секунд, следующее — ещё на 10.
 */

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [
    {
      txid: 'e'.repeat(64),
      address: ALICE.address,
      message: 'Ролик для проверки плеера',
      type: 'video',
      url: VIDEO_URL,
    },
  ],
  comments: [],
}

async function open(page: Page) {
  await useMockNode(page, DATA)
  await useMockPeerTube(page)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  // Чистый профиль — первый запуск: «Что нового» перекрывает страницу.
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

const video = (page: Page) => page.locator('video').first()
const container = (page: Page) => video(page).locator('xpath=ancestor::div[@tabindex="0"][1]')
const state = (page: Page) =>
  video(page).evaluate((v: HTMLVideoElement) => ({
    time: v.currentTime,
    paused: v.paused,
    rate: v.playbackRate,
  }))

/** Запустить ролик большой кнопкой и дождаться, пока он пойдёт. */
async function start(page: Page, tap = false) {
  const play = page.getByRole('button', { name: 'Смотреть', exact: true })
  await play.waitFor({ timeout: 20_000 })
  await play.scrollIntoViewIfNeeded()
  if (tap) await play.tap()
  else await play.click()
  await expect.poll(async () => (await state(page)).time, { timeout: 15_000 }).toBeGreaterThan(0.5)
}

test.describe('Плеер мышью', () => {
  test('клик — пауза, стрелка — на 5 секунд, цифра — к доле ролика', async ({ page }) => {
    await open(page)
    await start(page)
    await container(page).click()
    await expect.poll(async () => (await state(page)).paused).toBe(true)

    const before = (await state(page)).time
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await state(page)).time).toBeCloseTo(before + 5, 0)

    await page.keyboard.press('Digit5')
    await expect.poll(async () => (await state(page)).time).toBeCloseTo(15, 0)
    await expect(container(page).getByText('0:15 / 0:30')).toBeVisible()
  })

  test('полоса перемотки перематывает и не ставит на паузу, даже если отпустить над роликом', async ({
    page,
  }) => {
    await open(page)
    await start(page)
    await container(page).hover()
    const bar = container(page).getByRole('slider', { name: 'Перемотка' })
    const box = (await bar.boundingBox())!
    const y = box.y + box.height / 2
    // Пауза по щелчку срабатывает с задержкой (ждёт второго щелчка) — ждём дольше неё.
    const settle = () => page.waitForTimeout(400)

    await page.mouse.click(box.x + box.width * 0.75, y)
    await expect.poll(async () => (await state(page)).time).toBeCloseTo(22.5, 0)
    await settle()
    expect((await state(page)).paused).toBe(false)

    // Потянули ползунок назад и отпустили уже над самим роликом.
    await page.mouse.move(box.x + box.width * 0.75, y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.25, y, { steps: 5 })
    await page.mouse.move(box.x + box.width * 0.25, y - 120, { steps: 3 })
    await page.mouse.up()
    await expect.poll(async () => (await state(page)).time).toBeLessThan(12)
    await settle()
    expect((await state(page)).paused).toBe(false)

    // Щелчок по самому ролику по-прежнему ставит на паузу.
    await page.mouse.click(box.x + box.width / 2, y - 120)
    await expect.poll(async () => (await state(page)).paused).toBe(true)
  })

  test('скорость — из меню настроек, как у YouTube', async ({ page }) => {
    await open(page)
    await start(page)
    await container(page).hover()
    await container(page).getByRole('button', { name: 'Настройки' }).click()
    await page.getByRole('menuitem', { name: /Скорость/ }).click()
    await page.getByRole('menuitemradio', { name: '1,5' }).click()
    await expect.poll(async () => (await state(page)).rate).toBe(1.5)
    await expect(page.getByRole('menu')).toHaveCount(0)
  })
})

test.describe('Плеер пальцем', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('касание показывает панель и не ставит на паузу', async ({ page }) => {
    await open(page)
    await start(page, true)
    const box = (await container(page).boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2 + 30)
    await expect(container(page).getByRole('button', { name: 'Пауза (k)' })).toBeVisible()
    expect((await state(page)).paused).toBe(false)
  })

  test('двойное касание справа — вперёд на 10 секунд, следующее — ещё на 10', async ({ page }) => {
    await open(page)
    await start(page, true)
    const box = (await container(page).boundingBox())!
    const x = box.x + box.width * 0.85
    const y = box.y + box.height / 2
    const before = (await state(page)).time
    await page.touchscreen.tap(x, y)
    await page.touchscreen.tap(x, y)
    await expect.poll(async () => (await state(page)).time).toBeGreaterThan(before + 9)
    await page.touchscreen.tap(x, y)
    await expect.poll(async () => (await state(page)).time).toBeGreaterThan(before + 19)
    await expect(container(page).getByText(/20 секунд/)).toBeVisible()
  })
})
