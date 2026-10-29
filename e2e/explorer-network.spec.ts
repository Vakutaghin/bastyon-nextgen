import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Вкладка «Сеть» «Блокчейн-обозревателя» на подменной ноде: сеть опрашивается
 * только по кнопке, обход проходит от нод пула прокси к их соседям, карта
 * остаётся после перезагрузки. Страны — из встроенной таблицы: 5.9.x.x —
 * Германия (Hetzner), 95.31.x.x — Россия, 8.8.8.8 — США.
 */

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

async function open(page: Page, path: string) {
  await useMockNode(page, DATA)
  await page.goto(path)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

function countSurveys(page: Page): () => number {
  let n = 0
  page.on('request', (req) => {
    if (/\/rpc\/getpeerinfo$/.test(req.url())) n++
  })
  return () => n
}

test('сеть опрашивается только по кнопке; карта собирается и переживает перезагрузку', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const surveys = countSurveys(page)
  await open(page, '/explorer/network')

  await expect(page.getByRole('heading', { name: 'Блокчейн-обозреватель' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText('Карта сети ещё не собрана')).toBeVisible()
  await page.waitForTimeout(1500)
  expect(surveys()).toBe(0)

  await page.getByRole('button', { name: 'Собрать карту сети' }).first().click()
  const status = page.getByRole('status').filter({ hasText: /Карта собрана/ })
  await expect(status).toBeVisible({ timeout: 30_000 })
  // Трое открытых ответили, ноду за роутером не спрашивали.
  await expect(status).toContainText('опрошено нод — 3, ответили — 3')
  expect(surveys()).toBe(3)

  const nodesTile = page
    .locator('div')
    .filter({ hasText: /^Нод в сети/ })
    .first()
  await expect(nodesTile).toContainText('4')
  await expect(page.getByText('приложений: 120').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Германия/ }).first()).toBeVisible()

  // Строка таблицы открывает карточку ноды на схеме.
  await page.getByRole('row', { name: /8\.8\.8\.8/ }).click()
  const card = page.getByRole('complementary', { name: '8.8.8.8' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Полная нода')
  await expect(card).toContainText('0.22.21')

  // Следующее открытие — та же карта сразу и без новых запросов.
  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: /Карта собрана/ })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByRole('row', { name: /188\.170\.1\.1/ })).toContainText('за роутером')
  expect(surveys()).toBe(3)
})

test('прежняя страница «Пиры сети» открывает вкладку «Сеть»', async ({ page }) => {
  await open(page, '/explorer/peers')
  await expect(page).toHaveURL(/\/explorer\/network$/)
  await expect(page.getByRole('link', { name: 'Сеть' }).first()).toHaveAttribute(
    'aria-current',
    'page'
  )
})
