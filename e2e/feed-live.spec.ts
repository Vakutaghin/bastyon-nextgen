import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «Новые посты сразу»: новый пост сам встаёт наверх ленты. Кто читает ниже,
 * остаётся на своём месте; кто наверху — видит новый пост. Нода подменная:
 * новый пост появляется в её данных посреди теста, ленту спрашиваем
 * возвратом в окно — без ожидания опроса раз в полминуты. Места под новые
 * посты в данных с самого начала, только скрыты: id поста у подменной ноды —
 * его номер в списке, и вставка в начало сдвинула бы id остальных.
 */

const BOB = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const APP_VERSION = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
  .version
const txid = (prefix: string, i: number): string => prefix + String(i).padStart(63, '0')

function makeData(): MockNodeData {
  // Два места под новые посты: второй придёт первым и встанет ниже первого.
  const slots = [0, 1].map((i) => ({
    txid: txid('n', i),
    address: BOB,
    message: '',
    ago: 5 * (i + 1),
    byIdOnly: true,
  }))
  return {
    profiles: [{ address: BOB, name: 'bob_ng' }],
    posts: [
      ...slots,
      ...Array.from({ length: 20 }, (_, i) => ({
        txid: txid('b', i),
        address: BOB,
        message: `Пост ${String(i + 1).padStart(2, '0')}`,
        ago: 600 * (i + 1),
      })),
    ],
    comments: [],
  }
}

const card = (page: Page, text: string) => page.locator('.post-card', { hasText: text })

async function arrives(
  page: Page,
  data: MockNodeData,
  message: string,
  slot: number
): Promise<void> {
  Object.assign(data.posts[slot]!, { message, byIdOnly: false })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('.post-card').first()).toContainText(message, { timeout: 15_000 })
}

test('новый пост встаёт наверх и не сдвигает того, кто читает ниже', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  const data = makeData()
  await useMockNode(page, data)
  await page.addInitScript((version) => {
    localStorage.setItem('bastyon_locale', 'ru')
    localStorage.setItem('bastyonChangelogLastSeenVersion', version)
  }, APP_VERSION)
  await page.goto('/')
  await expect(card(page, 'Пост 01')).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('Новые посты сразу').click()
  await expect(page.getByLabel('Новые посты сразу')).toHaveAttribute('aria-checked', 'true')

  // Читаем шестой пост — он в середине экрана. Прокрутка мгновенная: у
  // страницы scroll-behavior: smooth, и замер попал бы в середину анимации.
  await card(page, 'Пост 06').scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy({ top: -200, behavior: 'instant' }))
  const before = (await card(page, 'Пост 06').boundingBox())!.y
  await arrives(page, data, 'Только что написали', 1)
  // Карточка нового поста дорастает и после вставки — ждём, пока лента устоится.
  await expect
    .poll(async () => Math.abs((await card(page, 'Пост 06').boundingBox())!.y - before))
    .toBeLessThan(2)
  // Пилюли «новые посты» нет: пост уже в ленте.
  await expect(page.getByText(/Показать новые посты/)).toHaveCount(0)

  // Наверху ленты новый пост виден сразу.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await arrives(page, data, 'И ещё один', 0)
  const top = (await card(page, 'И ещё один').boundingBox())!
  expect(top.y).toBeGreaterThanOrEqual(0)
  expect(top.y).toBeLessThan(900)
})
