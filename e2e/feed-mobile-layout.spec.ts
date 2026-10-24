import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, VIDEO_URL } from './support/mock-peertube'

/**
 * Пост на телефоне — как в Instagram: во всю ширину экрана, без рамки, а
 * картинки и ролик — от края до края. На компьютере карточка остаётся
 * карточкой: рамка, отступы, скруглённые картинки.
 */

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const IMAGE_POST = 'a'.repeat(64)
const DATA: MockNodeData = {
  profiles: [{ address: ALICE, name: 'alice_ng' }],
  posts: [
    {
      txid: IMAGE_POST,
      address: ALICE,
      message: 'Пост с картинкой',
      images: ['https://bastyon.com/images/e2e.jpg'],
      ago: 300,
    },
    {
      txid: 'b'.repeat(64),
      address: ALICE,
      type: 'video',
      url: VIDEO_URL,
      caption: 'Ролик',
      message: 'Описание ролика',
      ago: 600,
    },
    { txid: 'c'.repeat(64), address: ALICE, message: 'Просто текст', ago: 900 },
    {
      txid: 'd'.repeat(64),
      address: ALICE,
      message: `Длинный пост. ${'Текст, который не помещается в карточку. '.repeat(20)}`,
      images: ['https://bastyon.com/images/e2e.jpg'],
      ago: 1200,
    },
  ],
  comments: [],
}

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

async function open(page: Page, path: string): Promise<void> {
  await useMockNode(page, DATA)
  await useMockPeerTube(page)
  await page.route('https://bastyon.com/images/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL })
  )
  await page.goto(path)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

const card = (page: Page, text: string): Locator =>
  page.locator('.post-card').filter({ hasText: text }).first()

async function box(locator: Locator): Promise<{ x: number; width: number }> {
  const b = await locator.boundingBox()
  return { x: Math.round(b?.x ?? -1), width: Math.round(b?.width ?? -1) }
}

const borderLeft = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).borderLeftWidth)

test.describe('на телефоне', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  for (const [where, path] of [
    ['лента', '/'],
    ['профиль', `/${ALICE}`],
  ] as const) {
    test(`${where}: пост во всю ширину, без рамки, картинка и ролик от края до края`, async ({
      page,
    }) => {
      await open(page, path)
      const withImage = card(page, 'Пост с картинкой')
      await expect(withImage).toBeVisible({ timeout: 30_000 })
      expect(await box(withImage)).toEqual({ x: 0, width: 390 })
      expect(await borderLeft(withImage)).toBe('0px')
      expect(await box(withImage.getByTestId('post-media'))).toEqual({ x: 0, width: 390 })

      const withVideo = card(page, 'Описание ролика')
      await withVideo.scrollIntoViewIfNeeded()
      expect(await box(withVideo.getByTestId('post-media'))).toEqual({ x: 0, width: 390 })
      expect(
        await withVideo
          .getByTestId('post-media')
          .locator('> *')
          .first()
          .evaluate((el) => getComputedStyle(el).borderTopLeftRadius)
      ).toBe('0px')
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true)
    })
  }

  test('окно поста — во весь экран, картинка от края до края', async ({ page }) => {
    await open(page, '/')
    const long = card(page, 'Длинный пост')
    await expect(long).toBeVisible({ timeout: 30_000 })
    await long.getByRole('button', { name: 'Показать полностью' }).click()
    const modal = page.locator('.ant-modal-content').filter({ hasText: 'Длинный пост' })
    // Окно открывается с анимацией — меряем, когда она закончится.
    await expect
      .poll(async () => {
        const r = await modal.boundingBox()
        return [r?.x, r?.y, r?.width, r?.height].map((v) => Math.round(v ?? -1))
      })
      .toEqual([0, 0, 390, 844])
    expect(await box(modal.getByTestId('post-media'))).toEqual({ x: 0, width: 390 })
  })

  test('страница поста: пост во всю ширину', async ({ page }) => {
    await open(page, `/post/${IMAGE_POST}`)
    const post = card(page, 'Пост с картинкой')
    await expect(post).toBeVisible({ timeout: 30_000 })
    expect(await box(post)).toEqual({ x: 0, width: 390 })
    expect(await box(post.getByTestId('post-media'))).toEqual({ x: 0, width: 390 })
  })
})

test('на компьютере карточка остаётся карточкой, окно поста — окном', async ({ page }) => {
  await open(page, '/')
  const withImage = card(page, 'Пост с картинкой')
  await expect(withImage).toBeVisible({ timeout: 30_000 })
  expect(await borderLeft(withImage)).toBe('1px')
  const cardBox = await box(withImage)
  const mediaBox = await box(withImage.getByTestId('post-media'))
  expect(mediaBox.x).toBeGreaterThan(cardBox.x)
  expect(mediaBox.width).toBeLessThan(cardBox.width)

  await card(page, 'Длинный пост').getByRole('button', { name: 'Показать полностью' }).click()
  const modal = page.locator('.ant-modal-content').filter({ hasText: 'Длинный пост' })
  await expect(modal).toBeVisible()
  await expect
    .poll(async () => Math.round((await modal.boundingBox())?.x ?? 0))
    .toBeGreaterThan(100)
  expect((await modal.boundingBox())?.y).toBeGreaterThan(0)
})
