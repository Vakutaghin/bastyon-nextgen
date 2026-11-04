import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Обновление ленты протягиванием вниз на телефоне: палец в самом верху тянет
 * ленту — выезжает кружок; отпустили дальше порога — лента запрашивается
 * заново, кружок крутится и уходит. Короткий рывок ленту не обновляет.
 * Касания — через CDP, поэтому только Chromium.
 */

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const DATA: MockNodeData = {
  profiles: [{ address: ALICE, name: 'alice_ng' }],
  posts: Array.from({ length: 6 }, (_, i) => ({
    txid: `${i}`.repeat(64),
    address: ALICE,
    message: `Пост ${i}`,
    ago: 300 * (i + 1),
  })),
  comments: [],
}

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

/** Палец ведёт вниз от `from` на `distance` px за `steps` шагов и отпускает. */
async function drag(page: Page, from: number, distance: number, steps = 12): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  const point = (y: number) => [{ x: 195, y, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(from + (distance * i) / steps),
    })
  }
  await expect(page.getByTestId('pull-to-refresh')).toBeVisible()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

test('протянули ленту вниз — она обновилась', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'касания через CDP')
  test.setTimeout(90_000)
  let feedRequests = 0
  page.on('request', (request) => {
    if (/\/(gethistoricalstrip|gethierarchicalstrip)$/.test(request.url())) feedRequests += 1
  })
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await expect(page.getByText('Пост 0')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1_000)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  // Короткий рывок — кружок выехал и ушёл, ленту не спрашивали.
  const before = feedRequests
  await drag(page, 250, 60)
  await expect(page.getByTestId('pull-to-refresh')).toHaveCount(0)
  await page.waitForTimeout(500)
  expect(feedRequests).toBe(before)

  // Дотянули — лента запрошена заново, кружок крутится и уходит.
  await drag(page, 250, 300)
  await expect(page.getByTestId('pull-to-refresh')).toHaveClass(/refreshing/)
  await expect.poll(() => feedRequests).toBeGreaterThan(before)
  await expect(page.getByTestId('pull-to-refresh')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByText('Пост 0')).toBeVisible()
})
