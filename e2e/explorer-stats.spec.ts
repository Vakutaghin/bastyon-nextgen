import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode } from './support/mock-node'

/**
 * Вкладка «Статистика» «Блокчейн-обозревателя» на подменной ноде: история
 * сети по суткам (кусками по 10) и по часам, аккаунты, выпуск монет и
 * сложность. Графики рисуются, подсказка и стрелки показывают значения точки,
 * легенда прячет серии, таблица — те же числа. Переключение периода и второй
 * запуск обходятся без запросов к ноде: история лежит на устройстве. Нода не
 * ответила — «Повторить».
 */

/** Последний опорный блок chain-time.ts и средний шаг блока после него, с. */
const ANCHOR = [4_000_000, 1_788_431_552] as const
const BLOCK_SECONDS = 57.2
const NOW = Math.floor(Date.now() / 1000)
/** Вершина, согласованная с опорными блоками: иначе сутки ноды растягиваются во времени. */
const TIP = ANCHOR[0] + Math.floor((NOW - ANCHOR[1]) / BLOCK_SECONDS)
const DAY = 1440
const HOUR = 60
const TODAY = Math.floor(TIP / DAY)
const NOW_HOUR = Math.floor(TIP / HOUR)
/** Сколько суток истории у ноды: хватает на «Год». */
const HISTORY_DAYS = 400

/** Транзакции суток ноды по типам; 207 — «Прочее». */
function dayCounts(day: number): Record<string, number> {
  const k = day % 7
  return {
    '200': 100 + 10 * k,
    '201': 20,
    '204': 300,
    '300': 500,
    '302': 40,
    '100': 5,
    '1': 60 + k,
    '207': 3,
  }
}

function hourCounts(hour: number): Record<string, number> {
  return { '200': 4 + (hour % 5), '204': 12, '300': 20, '1': 2 + (hour % 3) }
}

const STATS = /\/rpc\/(getstatisticbydays|getstatisticbyhours|getstatisticcontentbyhours)$/
const SAMPLES = /\/rpc\/(getcoininfo|getcompactblock)$/

interface Node {
  /** Статистика ноды отвечает ошибкой. */
  down: boolean
  /** Сколько раз спрашивали статистику и выборку блоков. */
  requests: { stats: number; samples: number }
}

function rpcParams(route: Route): unknown[] {
  try {
    return (route.request().postDataJSON() as { parameters?: unknown[] })?.parameters ?? []
  } catch {
    return []
  }
}

function answer(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    json: { result: 'success', data },
  })
}

async function useStatsNode(page: Page): Promise<Node> {
  const node: Node = { down: false, requests: { stats: 0, samples: 0 } }
  await useMockNode(page, { profiles: [], posts: [], comments: [] })
  // Позже зарегистрированные правила срабатывают первыми.
  await page.context().route(/\.pocketnet\.app:8899\/rpc\//, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fallback()
    const method = new URL(request.url()).pathname.split('/').pop() ?? ''
    const params = rpcParams(route)
    if (method === 'getnodeinfo') return answer(route, { lastblock: { height: TIP, time: NOW } })
    if (STATS.test(request.url())) {
      node.requests.stats++
      if (node.down) {
        return route.fulfill({
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
          json: { error: { code: 500, message: 'sql request timeout' } },
        })
      }
    }
    if (method === 'getstatisticbydays') {
      // Кусок k — сутки [10k, 10k + 10): первый параметр — высота конца куска.
      const first = Number(params[0]) / DAY - Number(params[1])
      const out: Record<string, Record<string, number>> = {}
      for (let d = first; d < first + Number(params[1]); d++) {
        if (d < TODAY && d >= TODAY - HISTORY_DAYS) out[String(d)] = dayCounts(d)
      }
      return answer(route, out)
    }
    if (method === 'getstatisticbyhours') {
      const out: Record<string, Record<string, number>> = {}
      for (let h = NOW_HOUR - 168; h < NOW_HOUR; h++) out[String(h)] = hourCounts(h)
      return answer(route, out)
    }
    if (method === 'getstatisticcontentbyhours') {
      const out: Record<string, number> = {}
      for (let h = NOW_HOUR - 168; h < NOW_HOUR; h++)
        out[String(h)] = 900_000 + 3 * h - 3 * NOW_HOUR
      return answer(route, out)
    }
    if (SAMPLES.test(request.url())) {
      node.requests.samples++
      if (method === 'getcoininfo') {
        return answer(route, { emission: 10_000_000 + Number(params[0]) * 5 })
      }
      return answer(route, { difficulty: 50_000 + (Number(params[1]) % 997) })
    }
    return route.fallback()
  })
  return node
}

async function open(page: Page): Promise<void> {
  await page.goto('/explorer/stats')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

/** Карточка графика по заголовку. */
const card = (page: Page, title: string) =>
  page.locator('section').filter({ has: page.locator('h2', { hasText: title }) })

const activity = (page: Page) => card(page, 'Активность сети')

/** Синхронизация закончилась: в строке состояния — «Данные на …». */
async function synced(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: 'Данные на' })).toBeVisible({
    timeout: 60_000,
  })
}

const number = (text: string | null) =>
  Number((text ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'))

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 })
})

test('графики из истории ноды: подсказка, стрелки, легенда и таблица', async ({ page }) => {
  test.setTimeout(120_000)
  await useStatsNode(page)
  await open(page)
  await synced(page)

  const chart = activity(page)
  const svg = chart.locator('svg[role="img"]')
  await expect(svg.locator('path.layer')).toHaveCount(7)
  // Подписи оси значений — числа в локали.
  expect(await svg.locator('g.grid text').count()).toBeGreaterThan(1)

  // Наведение — значения всех серий в точке и «Всего».
  const tooltip = chart.locator('[aria-hidden="true"]').filter({ hasText: 'Всего' })
  const box = (await svg.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2)
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('Публикации')
  await expect(tooltip).toContainText('Переводы')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 200)
  await expect(tooltip).toBeHidden()

  // С клавиатуры: фокус — последняя точка, стрелка влево — предыдущая, Esc — убрать.
  await svg.focus()
  await expect(tooltip).toBeVisible()
  const lastDate = await tooltip.locator('div').first().textContent()
  await page.keyboard.press('ArrowLeft')
  await expect(tooltip.locator('div').first()).not.toHaveText(lastDate ?? '')
  await page.keyboard.press('Home')
  await expect(tooltip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tooltip).toBeHidden()

  // Легенда: нажатие прячет серию, двойное оставляет только её, ещё двойное — все.
  const legend = chart.getByRole('button', { name: 'Комментарии' })
  await legend.click()
  await expect(legend).toHaveAttribute('aria-pressed', 'false')
  await expect(svg.locator('path.layer')).toHaveCount(6)
  const transfers = chart.getByRole('button', { name: 'Переводы' })
  await transfers.dblclick()
  await expect(svg.locator('path.layer')).toHaveCount(1)
  await expect(chart.locator('button[aria-pressed="true"]', { hasText: 'Переводы' })).toHaveCount(1)
  await transfers.dblclick()
  await expect(svg.locator('path.layer')).toHaveCount(7)

  // Таблица — те же сутки; сумма «Всего» по строкам — итог в подзаголовке.
  // Сутки ноды — 1440 блоков, около 22,9 ч: в 30 днях их 31–32, плюс неполные по краям.
  await chart.getByRole('button', { name: 'Таблица' }).click()
  const rows = chart.locator('tbody tr')
  const n = await rows.count()
  expect(n).toBeGreaterThanOrEqual(31)
  expect(n).toBeLessThanOrEqual(33)
  const header = await chart.locator('thead th').allTextContents()
  expect(header[0]).toBe('Период')
  expect(header[header.length - 1]).toBe('Всего')
  const totals = await rows.locator('td:last-child').allTextContents()
  const sum = totals.reduce((s, t) => s + number(t), 0)
  const subtitle = await chart.locator('h2 + div').textContent()
  expect(number(subtitle?.split('транзакций')[0] ?? '')).toBe(sum)
  // Переводы суток — 60…66, как у ноды.
  const transferColumn = header.indexOf('Переводы') + 1
  for (const t of await rows.locator(`td:nth-child(${transferColumn})`).allTextContents()) {
    expect(number(t)).toBeGreaterThanOrEqual(60)
    expect(number(t)).toBeLessThanOrEqual(66)
  }
  await chart.getByRole('button', { name: 'График' }).click()
  await expect(svg.locator('path.layer')).toHaveCount(7)

  // Линии, столбцы и ось не от нуля: публикации, переводы, выпуск монет.
  await expect(card(page, 'Публикации по видам').locator('path.line')).toHaveCount(6)
  await expect(card(page, 'Переводы PKOIN').locator('g.bars')).toHaveCount(1)
  await expect(card(page, 'Выпущено PKOIN').locator('path.line')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(card(page, 'Сложность стейкинга').locator('path.line')).toHaveCount(1)
})

test('период и шаг — без запросов к ноде; второй запуск — из истории на устройстве', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const node = await useStatsNode(page)
  await open(page)
  await synced(page)
  const chart = activity(page)
  const svg = chart.locator('svg[role="img"]')
  await expect(svg.locator('path.layer')).toHaveCount(7)
  const asked = node.requests.stats

  // 48 часов — по часам ноды (60 блоков, около 57 мин): их около 50.
  await page.getByRole('button', { name: '48 ч', exact: true }).click()
  await chart.getByRole('button', { name: 'Таблица' }).click()
  const hours = await chart.locator('tbody tr').count()
  expect(hours).toBeGreaterThanOrEqual(49)
  expect(hours).toBeLessThanOrEqual(52)
  await chart.getByRole('button', { name: 'График' }).click()

  // Год по месяцам — в среднем за сутки.
  await page.getByRole('button', { name: 'Год', exact: true }).click()
  await page
    .getByRole('group', { name: 'Шаг графика' })
    .getByRole('button', { name: 'Месяцы' })
    .click()
  await expect(chart.locator('h2 + div')).toContainText('в сутки')
  await chart.getByRole('button', { name: 'Таблица' }).click()
  const months = await chart.locator('tbody tr').count()
  expect(months).toBeGreaterThanOrEqual(12)
  expect(months).toBeLessThanOrEqual(14)
  await chart.getByRole('button', { name: 'График' }).click()
  expect(node.requests.stats).toBe(asked)

  // Второй запуск: история на устройстве, нода не спрашивается.
  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await expect(svg.locator('path.layer')).toHaveCount(7, { timeout: 30_000 })
  await page.waitForTimeout(1500)
  expect(node.requests.stats).toBe(asked)
})

test('нода не ответила — «Нода не ответила» и «Повторить»', async ({ page }) => {
  test.setTimeout(120_000)
  const node = await useStatsNode(page)
  node.down = true
  await open(page)
  const chart = activity(page)
  await expect(chart).toContainText('Нода не ответила', { timeout: 60_000 })

  node.down = false
  await chart.getByRole('button', { name: 'Повторить' }).click()
  await expect(chart.locator('svg[role="img"] path.layer')).toHaveCount(7, { timeout: 60_000 })
  await synced(page)
})
