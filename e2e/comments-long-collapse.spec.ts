import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Длинные комментарии под постом свёрнуты: длиннее 10 видимых строк — видно 6,
 * «Показать полностью» разворачивает, «Свернуть» сворачивает обратно. Строки
 * считаются по раскладке, поэтому длинный абзац без переносов тоже
 * сворачивается, а короткий комментарий остаётся как был. Юнит-тест раскладку
 * подменяет — здесь настоящая высота строки в Chromium.
 */

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PAmockBob11111111111111111111111'
const POST = 'a'.repeat(64)
const id = (s: string): string => s.padEnd(64, '0')

const manyLines = Array.from({ length: 25 }, (_, i) => `Строка ${i + 1}`).join('\n')
const longParagraph = 'Длинный абзац без переносов строк. '.repeat(60)

const DATA: MockNodeData = {
  profiles: [
    { address: ALICE, name: 'alice_ng' },
    { address: BOB, name: 'bob_ng' },
  ],
  posts: [
    {
      txid: POST,
      address: ALICE,
      message: 'Пост с длинными комментариями',
      comments: 3,
      lastComment: id('c1'),
    },
  ],
  comments: [
    { id: id('c1'), postid: POST, address: BOB, message: manyLines, scoreUp: 3 },
    { id: id('c2'), postid: POST, address: ALICE, message: 'Короткий\nв три\nстроки' },
    { id: id('c3'), postid: POST, address: BOB, message: longParagraph },
  ],
}

const comment = (page: Page, key: string): Locator =>
  page.locator(`[data-comment-id="${id(key)}"]`).first()
const textOf = (item: Locator): Locator => item.getByTestId('comment-text').first()
const toggleOf = (item: Locator): Locator => item.getByTestId('comment-text-toggle').first()

/** Высота текста в строках его собственной высоты строки. */
const heightInLines = (text: Locator): Promise<number> =>
  text.evaluate((el) => {
    const lh = parseFloat(getComputedStyle(el).lineHeight)
    return el.getBoundingClientRect().height / lh
  })

async function openFeed(page: Page): Promise<void> {
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await expect(page.getByText('Пост с длинными комментариями').first()).toBeVisible({
    timeout: 20_000,
  })
}

for (const [label, viewport] of [
  ['на компьютере', { width: 1280, height: 900 }],
  ['на телефоне', { width: 360, height: 780 }],
] as const) {
  test.describe(label, () => {
    test.use({ viewport })

    test('длинные свёрнуты до 6 строк, короткий — как был', async ({ page }) => {
      test.setTimeout(90_000)
      await openFeed(page)

      // Превью последнего комментария под постом в ленте — пока единственный
      // текст комментария на странице.
      const previewText = page.getByTestId('comment-text')
      await expect(previewText).toHaveCount(1, { timeout: 20_000 })
      await expect(previewText).toHaveClass(/is-clamped/)
      await expect(page.getByTestId('comment-text-toggle')).toHaveText('Показать полностью')
      expect(await heightInLines(previewText)).toBeCloseTo(6, 0)

      await page.getByRole('button', { name: 'Загрузить ещё' }).first().click()
      await expect(comment(page, 'c3')).toBeVisible({ timeout: 20_000 })

      const short = comment(page, 'c2')
      await expect(textOf(short)).not.toHaveClass(/is-clamped/)
      await expect(toggleOf(short)).toHaveCount(0)

      // Абзац без \n: строки — по ширине, свёрнут и на широком экране.
      const paragraph = comment(page, 'c3')
      await expect(textOf(paragraph)).toHaveClass(/is-clamped/)
      expect(await heightInLines(textOf(paragraph))).toBeCloseTo(6, 0)

      const many = comment(page, 'c1')
      await toggleOf(many).click()
      await expect(textOf(many)).not.toHaveClass(/is-clamped/)
      await expect(toggleOf(many)).toHaveText('Свернуть')
      expect(await heightInLines(textOf(many))).toBeGreaterThan(24)

      await toggleOf(many).click()
      await expect(textOf(many)).toHaveClass(/is-clamped/)
      await expect(toggleOf(many)).toBeInViewport()

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width)
    })
  })
}
