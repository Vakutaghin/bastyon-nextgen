import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Схема сети: легенда — флажки, которые прячут группы нод; раскладка «Карта» —
 * подложка OpenFreeMap (MapLibre) и ноды по городам из таблицы DB-IP; щипок
 * на тачпаде Mac (жесты WebKit) меняет масштаб. Стиль подложки и таблица —
 * свои: в сеть тест не ходит.
 */

/** Стиль подложки без источников: MapLibre грузит его сразу. */
const STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#a3c9e8' } }],
}

const DATA: MockNodeData = {
  profiles: [],
  posts: [],
  comments: [],
  network: {
    pool: ['5.9.10.10', '95.31.45.162'],
    clients: 120,
    peers: {
      '5.9.10.10': [
        { addr: '95.31.45.162:37070' },
        { addr: '8.8.8.8:37070' },
        { addr: '188.170.1.1:51000', inbound: true },
      ],
      '95.31.45.162': [{ addr: '5.9.10.10:37070' }, { addr: '8.8.8.8:37070', version: '0.22.20' }],
      '8.8.8.8': [{ addr: '5.9.10.10:51001', inbound: true }],
    },
  },
}

async function buildMap(page: Page): Promise<void> {
  await useMockNode(page, DATA)
  await page.goto('/explorer/network')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Собрать карту сети' }).first().click()
  await expect(page.getByRole('status').filter({ hasText: /Карта собрана/ })).toBeVisible({
    timeout: 30_000,
  })
}

/** Снимок холста, когда он перестал меняться (анимации обхода и раскладки). */
async function settled(canvas: Locator): Promise<Buffer> {
  let last = await canvas.screenshot()
  for (let i = 0; i < 20; i++) {
    await canvas.page().waitForTimeout(250)
    const next = await canvas.screenshot()
    if (next.equals(last)) return next
    last = next
  }
  return last
}

/** Щипок, как его присылает WebKit на Mac: gesturestart → gesturechange → gestureend. */
async function pinch(canvas: Locator, scale: number): Promise<void> {
  await canvas.evaluate((el, s) => {
    const box = el.getBoundingClientRect()
    const fire = (type: string, value: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.assign(event, {
        scale: value,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      })
      el.dispatchEvent(event)
    }
    fire('gesturestart', 1)
    fire('gesturechange', (1 + s) / 2)
    fire('gesturechange', s)
    fire('gestureend', s)
  }, scale)
}

test('легенда прячет группы, «Карта» ставит ноды по городам, щипок масштабирует', async ({
  page,
}) => {
  test.setTimeout(120_000)
  let styles = 0
  await page.route(/tiles\.openfreemap\.org/, (route) => {
    styles++
    return route.fulfill({ json: STYLE, headers: { 'access-control-allow-origin': '*' } })
  })
  let tables = 0
  await page.route(/raw\.githubusercontent\.com|cdn\.jsdelivr\.net/, (route) => {
    tables++
    return route.fulfill({
      path: 'geo-data/ipv4-city.bin.gz',
      contentType: 'application/octet-stream',
    })
  })
  await buildMap(page)

  const canvas = page.getByRole('img', { name: /Схема сети/ })
  const legend = page.getByRole('group', { name: 'Что показывать' })
  await expect(legend.getByRole('checkbox', { name: /пул прокси/ })).toBeVisible()

  // Флажок прячет группу и возвращает её.
  const before = await settled(canvas)
  const synced = legend.getByRole('checkbox', { name: /Синхронизирована/ })
  await synced.click()
  await expect(synced).toHaveAttribute('aria-checked', 'false')
  expect((await settled(canvas)).equals(before)).toBe(false)
  await synced.click()
  await expect(synced).toHaveAttribute('aria-checked', 'true')

  // Щипок на схеме.
  const diagram = await settled(canvas)
  await pinch(canvas, 2)
  expect((await settled(canvas)).equals(diagram)).toBe(false)

  // Карта: подложка грузится, таблица городов — один раз, на схеме её не было.
  expect(tables).toBe(0)
  await page.getByRole('radio', { name: 'Карта' }).click()
  await expect(page.getByRole('link', { name: '© OpenStreetMap' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'IP Geolocation by DB-IP' })).toBeVisible()
  await expect.poll(() => styles).toBeGreaterThan(0)
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(1)
  await expect(page.getByText(/Скачивается таблица городов/)).toHaveCount(0, { timeout: 30_000 })
  await expect(page.getByText(/Таблицу городов скачать не удалось/)).toHaveCount(0)
  expect(tables).toBe(1)
  // Пулов прокси на карте нет — и флажка для них тоже.
  await expect(legend.getByRole('checkbox', { name: /пул прокси/ })).toHaveCount(0)

  // Строка таблицы находит ноду и на карте.
  await page.getByRole('row', { name: /95\.31\.45\.162/ }).click()
  await expect(page.getByRole('complementary', { name: '95.31.45.162' })).toBeVisible()
  await page.keyboard.press('Escape')

  const map = await settled(canvas)
  await pinch(canvas, 0.5)
  expect((await settled(canvas)).equals(map)).toBe(false)

  // Вернулись на схему — снова с пулами прокси.
  await page.getByRole('radio', { name: 'Кольца' }).click()
  await expect(legend.getByRole('checkbox', { name: /пул прокси/ })).toBeVisible()
  await expect(page.getByRole('link', { name: '© OpenStreetMap' })).toHaveCount(0)
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
})
