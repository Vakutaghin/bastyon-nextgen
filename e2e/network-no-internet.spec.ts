import { readFileSync } from 'node:fs'
import { test, expect, type Browser, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «Сеть есть, интернета нет»: устройство подключено (`navigator.onLine`
 * остаётся true, событий `online`/`offline` нет), а прокси Bastyon не
 * отвечают — гостевой Wi-Fi до входа, блокировка. Два вида тишины: соединение
 * сразу отвергается и запрос висит без ответа. Приложение должно за секунды
 * сказать, что связи нет, не стучаться без конца, а когда прокси снова
 * ответят — загрузить ленту само, без «Повторить» и без события `online`.
 *
 * Нода подменная (useMockNode), поверх неё — своё правило для прокси: оно
 * обрывает или держит запросы, пока `mode` не станет 'ok'. Числа замера —
 * в выводе теста (`[no-internet]`).
 */

const BOB = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const APP_VERSION = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
  .version
const PROXY = /\.pocketnet\.app:8899\//
const NO_CONNECTION = /Сеть есть, но Bastyon не отвечает/

type Mode = 'ok' | 'refuse' | 'hang'

function makeData(): MockNodeData {
  return {
    profiles: [{ address: BOB, name: 'bob_ng' }],
    posts: Array.from({ length: 20 }, (_, i) => ({
      txid: 'b' + String(i).padStart(63, '0'),
      address: BOB,
      message: `Пост ${String(i + 1).padStart(2, '0')}`,
      ago: 600 * (i + 1),
    })),
    comments: [],
  }
}

/** Прогреть dev-сервер отдельным контекстом: замер не должен ждать сборки модулей. */
async function warmUp(browser: Browser): Promise<void> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await useMockNode(page, makeData())
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 90_000 })
  await expect(page.locator('.post-card').first()).toBeVisible({ timeout: 60_000 })
  await context.close()
}

/** Подменная нода, а поверх — тишина прокси по `state.mode`; запросы к прокси — в журнал. */
async function setUp(page: Page, initial: Mode) {
  const state = { mode: initial }
  const hits: Array<{ at: number; ping: boolean; mode: Mode }> = []
  await useMockNode(page, makeData())
  // Позже зарегистрированное правило срабатывает первым; fallback — к подменной ноде.
  await page.context().route(PROXY, async (route) => {
    hits.push({ at: Date.now(), ping: route.request().url().endsWith('/ping'), mode: state.mode })
    if (state.mode === 'ok') return route.fallback()
    if (state.mode === 'refuse') return route.abort('connectionrefused')
    // 'hang': не отвечаем — запрос висит, пока его не оборвёт сам клиент.
  })
  await page.addInitScript((version) => {
    localStorage.setItem('bastyon_locale', 'ru')
    localStorage.setItem('bastyonChangelogLastSeenVersion', version)
    // Событий сети в тесте быть не должно: сеть «есть» всё время.
    for (const type of ['online', 'offline']) {
      window.addEventListener(
        type,
        () => ((window as never as Record<string, number>)[`__${type}`] = 1)
      )
    }
  }, APP_VERSION)
  return { state, hits }
}

function report(name: string, data: Record<string, unknown>): void {
  process.stdout.write(`[no-internet] ${name} ${JSON.stringify(data)}\n`)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000)
  await warmUp(browser)
})

for (const silence of ['refuse', 'hang'] as const) {
  test(`прокси ${silence === 'refuse' ? 'отвергают соединение' : 'молчат'}: «связи нет» за секунды, вернулись — лента сама`, async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1400, height: 900 })
    const { state, hits } = await setUp(page, silence)

    await page.goto('/')
    await expect(page.getByText(NO_CONNECTION).first()).toBeVisible({ timeout: 60_000 })
    const shownAt = Date.now()
    const first = hits[0]!.at
    const detectS = (shownAt - first) / 1000

    // Пока связи нет — не стучимся без конца: 20 с тишины, считаем запросы.
    const before = hits.length
    await page.waitForTimeout(20_000)
    const idle = hits.slice(before)

    // Прокси снова отвечают. Ни «Повторить», ни события `online`.
    state.mode = 'ok'
    const backAt = Date.now()
    await expect(page.locator('.post-card', { hasText: 'Пост 01' })).toBeVisible({
      timeout: 45_000,
    })
    const recoverS = (Date.now() - backAt) / 1000
    const events = await page.evaluate(() => {
      const w = window as never as Record<string, number | undefined>
      return { online: w.__online ?? 0, offline: w.__offline ?? 0 }
    })

    report(silence, {
      detectS,
      requestsUntilShown: hits.filter((h) => h.at <= shownAt).length,
      idle20s: { total: idle.length, pings: idle.filter((h) => h.ping).length },
      recoverS,
      events,
    })

    expect(events).toEqual({ online: 0, offline: 0 })
    // Раньше: отвергнутые — сразу «Сеть Bastyon не отвечает» и сотни повторов;
    // висящие — до 30 с на каждый из 7 прокси, с повторами vue-query — минуты.
    expect(detectS).toBeLessThan(silence === 'refuse' ? 5 : 35)
    // Тишина: только перепроверка связи (круг пинга через 5, 10, 20 с) — ни
    // одного запроса ленты.
    expect(idle.filter((h) => !h.ping)).toHaveLength(0)
    expect(idle.length).toBeLessThanOrEqual(4 * 7)
    // Перепроверка — не реже чем раз в 30 с.
    expect(recoverS).toBeLessThan(35)
  })
}
