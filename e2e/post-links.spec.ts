import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Ссылки в посте: в тексте — цветом и с подчёркиванием; карточка ссылки —
 * квадратная картинка слева (открывается в просмотрщике), текст справа, всё
 * мимо картинки — ссылка в новом окне; ширина ограничена, карточка у левого
 * края. Нода подменная.
 */

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const LINK = 'https://example.org/article'
const OG_IMAGE = 'https://bastyon.com/images/og.png'

const DATA: MockNodeData = {
  profiles: [{ address: ALICE, name: 'alice_ng' }],
  posts: [
    {
      txid: 'a'.repeat(64),
      address: ALICE,
      message: `Почитайте ${LINK} — там подробно.`,
      url: LINK,
      ago: 300,
    },
  ],
  comments: [],
  linkPreviews: {
    [LINK]: {
      title: 'Как устроена сеть Pocketnet',
      description: 'Подробный разбор: ноды, репутация, публикации и комиссии.',
      site_name: 'Example',
      image: OG_IMAGE,
    },
  },
}

const IMAGE = readFileSync(join(process.cwd(), 'public/img/icon-512.png'))

async function open(page: Page): Promise<void> {
  await useMockNode(page, DATA)
  await page.route(OG_IMAGE, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: IMAGE })
  )
  // Сайт из ссылки открывается в новом окне — отвечаем за него тут же.
  await page
    .context()
    .route(LINK, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Example</title>' })
    )
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

test('ссылка в тексте поста — цветом и с подчёркиванием', async ({ page }) => {
  test.setTimeout(120_000)
  await open(page)
  const post = page.locator('.post-card').filter({ hasText: 'Почитайте' }).first()
  const link = post.getByRole('link', { name: LINK, exact: true })
  await expect(link).toBeVisible({ timeout: 30_000 })
  const style = await link.evaluate((a) => {
    const text = getComputedStyle(a.parentElement!)
    const own = getComputedStyle(a)
    return { line: own.textDecorationLine, color: own.color, textColor: text.color }
  })
  expect(style.line).toContain('underline')
  expect(style.color).not.toBe(style.textColor)
})

test('карточка ссылки: квадрат слева открывает просмотрщик, остальное — сайт', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await open(page)
  const card = page.getByTestId('link-preview-card').first()
  await expect(card).toContainText('Как устроена сеть Pocketnet', { timeout: 30_000 })

  const image = card.locator('img')
  await expect(image).toBeVisible()
  const img = (await image.boundingBox())!
  const title = (await card.getByText('Как устроена сеть Pocketnet').boundingBox())!
  const box = (await card.boundingBox())!
  expect(Math.abs(img.width - img.height)).toBeLessThan(1)
  expect(img.x + img.width).toBeLessThanOrEqual(title.x)
  expect(box.width).toBeLessThanOrEqual(800)
  // Карточка у левого края поста — там же, где его текст.
  const text = (await page.locator('.post-card').first().getByText('Почитайте').boundingBox())!
  expect(Math.abs(box.x - text.x)).toBeLessThan(2)

  await card.getByRole('button', { name: 'Открыть картинку' }).click()
  await expect(page.getByRole('button', { name: 'Скачать изображение' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Скачать изображение' })).toBeHidden()

  // Нажатие мимо картинки — сайт в новом окне.
  const popup = page.waitForEvent('popup')
  await card.click({ position: { x: box.width - 20, y: box.height - 10 } })
  expect((await popup).url()).toContain('example.org/article')
})
