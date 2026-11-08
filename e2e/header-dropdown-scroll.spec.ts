import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Выпадашки шапки не отходят от неё, когда страница прокручивается под ними.
 * Шапка закреплена, а панели жили в координатах страницы: колесо над
 * мини-чатом, дойдя до края переписки, листало ленту — и открытое меню
 * уведомлений или Tor уезжало вместе с ней.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'

const DATA: MockNodeData = {
  profiles: [{ address: ME, name: 'me_ng' }],
  posts: Array.from({ length: 12 }, (_, i) => ({
    txid: String(i).padStart(64, 'a'),
    address: ME,
    message: `Пост ${i}`,
    ago: 600 + i,
  })),
  comments: [],
}

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 900 })
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
  await expect(page.getByText('Пост 11')).toBeVisible({ timeout: 30_000 })
}

async function top(panel: Locator): Promise<number> {
  const box = await panel.boundingBox()
  if (!box) throw new Error('панель не видна')
  return Math.round(box.y)
}

/**
 * Открыть панель, прокрутить ленту колесом и убедиться, что панель там же.
 * `ready` — содержимое, после которого панель больше не меняет размер: antd
 * переставляет панель, когда она растёт, и это скрыло бы сдвиг.
 */
async function staysUnderHeader(
  page: Page,
  trigger: Locator,
  panel: Locator,
  ready: Locator
): Promise<void> {
  await trigger.click()
  await expect(ready).toBeVisible({ timeout: 15_000 })
  // Анимация появления: до её конца панель ещё едет.
  await expect.poll(() => panel.getAttribute('class')).not.toMatch(/-(enter|appear)/)
  const before = await top(panel)
  const header = await page.getByRole('banner').boundingBox()
  expect(before).toBeGreaterThanOrEqual(Math.round(header!.height) - 16)
  // Панель встала под свою кнопку: правые края совпадают (placement bottomRight).
  const t = (await trigger.boundingBox())!
  const p = (await panel.boundingBox())!
  expect(Math.abs(p.x + p.width - (t.x + t.width))).toBeLessThanOrEqual(2)

  const scrolled = await page.evaluate(() => window.scrollY)
  await page.mouse.move(600, 700)
  await page.mouse.wheel(0, 400)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled)
  expect(await top(panel)).toBe(before)

  await trigger.click()
  await expect(panel).toBeHidden()
}

test('меню уведомлений и аккаунта стоят под шапкой, пока лента прокручивается', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signIn(page)
  // Мини-чат открыт, как в жалобе.
  await page.evaluate(async () => {
    type Store = Record<string, (...a: unknown[]) => unknown>
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
      }
    ).__vue_app__
    await app.config.globalProperties.$pinia._s.get('messenger')!.openMessenger!()
  })

  const header = page.getByRole('banner')
  const notifications = page.locator('.header-notifications-dropdown')
  await staysUnderHeader(
    page,
    header.getByRole('button', { name: 'Уведомления' }),
    notifications,
    notifications.getByText('Нет новых уведомлений')
  )
  const account = page.locator('.header-user-dropdown')
  await staysUnderHeader(
    page,
    // Кнопка меню — аватар вместе с ником.
    page.locator('.ant-dropdown-trigger:has([data-header-avatar])'),
    account,
    account.getByRole('menuitem').first()
  )
})
