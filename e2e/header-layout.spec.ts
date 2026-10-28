import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Настройки → «Шапка и меню»: значки справа от поиска и пункты меню аватара
 * убираются и переставляются — мышью за ручку и стрелками; раскладка
 * переживает перезагрузку, «Вернуть по умолчанию» возвращает как было.
 * По умолчанию «Сообщить об ошибке» — в меню, а не в шапке.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'

const DATA: MockNodeData = {
  profiles: [{ address: ME, name: 'me_ng' }],
  posts: [],
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
}

/** Пункты меню аватара сверху вниз. */
async function accountMenu(page: Page): Promise<string[]> {
  await page.locator('[data-header-avatar]').click()
  const menu = page.locator('.header-user-dropdown')
  await expect(menu).toBeVisible()
  const items = await menu.getByRole('menuitem').allInnerTexts()
  await page.locator('[data-header-avatar]').click()
  await expect(menu).toBeHidden()
  return items.map((s) => s.trim())
}

test('значки шапки и меню аккаунта: скрыть, переставить, сохранить, вернуть', async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page)
  const header = page.getByRole('banner')
  const bell = header.getByRole('button', { name: 'Уведомления' })
  await expect(bell).toBeVisible()
  await expect(header.getByRole('button', { name: 'Сообщить об ошибке' })).toHaveCount(0)
  expect(await accountMenu(page)).toContain('Сообщить об ошибке')

  await page.goto('/settings?tab=layout')
  const icons = page.getByTestId('layout-header')
  const menu = page.getByTestId('layout-menu')
  await expect(icons.getByText('Светлая и тёмная тема')).toBeVisible({ timeout: 30_000 })

  // Колокольчик убрали — из шапки пропал.
  await icons.getByRole('switch', { name: 'Показывать: Уведомления' }).click()
  await expect(bell).toHaveCount(0)

  // Тему — в начало стрелками с клавиатуры.
  const themeHandle = icons.getByRole('button', { name: 'Переместить: Светлая и тёмная тема' })
  await themeHandle.focus()
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp')
  await expect(themeHandle).toBeFocused()
  await expect(icons.getByRole('listitem').first()).toContainText('Светлая и тёмная тема')
  const services = header.getByRole('button', { name: /Сервисы/ })
  const themeButton = header.getByRole('button', { name: /(Светлая|Тёмная) тема/ })
  const themeX = (await themeButton.boundingBox())!.x
  expect(themeX).toBeLessThan((await services.boundingBox())!.x)

  // «Настройки» — наверх меню мышью за ручку.
  // Список целиком в окне: мышь водят по экрану, а не по странице. Без
  // плавной прокрутки — иначе координаты сняты бы посреди анимации.
  await menu.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const handle = menu.getByRole('button', { name: 'Переместить: Настройки' })
  const top = menu.getByRole('listitem').first()
  const from = (await handle.boundingBox())!
  const to = (await top.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 20 })
  await page.mouse.up()
  await expect(menu.getByRole('listitem').first()).toContainText('Настройки')
  // «Настройки» не скрываются.
  await expect(menu.getByRole('switch', { name: 'Показывать: Настройки' })).toBeDisabled()

  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await expect(page.getByTestId('layout-menu').getByRole('listitem').first()).toContainText(
    'Настройки',
    { timeout: 30_000 }
  )
  await expect(header.getByRole('button', { name: 'Уведомления' })).toHaveCount(0)
  expect((await accountMenu(page))[0]).toBe('Настройки')

  await page
    .getByTestId('layout-header')
    .getByRole('button', { name: 'Вернуть по умолчанию' })
    .click()
  await page
    .getByTestId('layout-menu')
    .getByRole('button', { name: 'Вернуть по умолчанию' })
    .click()
  await expect(header.getByRole('button', { name: 'Уведомления' })).toBeVisible()
  expect((await accountMenu(page))[0]).toBe('Профиль')
})

test('у пунктов меню аккаунта значки слева от подписи', async ({ page }) => {
  test.setTimeout(90_000)
  await signIn(page)
  await page.locator('[data-header-avatar]').click()
  const menu = page.locator('.header-user-dropdown')
  await expect(menu).toBeVisible()
  // Меню выезжает с масштабом: размеры — после анимации.
  await expect(menu).not.toHaveClass(/slide-up-enter/)

  const items = menu.getByRole('menuitem')
  const count = await items.count()
  expect(count).toBeGreaterThan(5)
  for (let i = 0; i < count; i++) {
    const item = items.nth(i)
    const icon = item.locator('.ant-dropdown-menu-item-icon svg')
    await expect(icon, await item.innerText()).toBeVisible()
    const iconBox = (await icon.boundingBox())!
    const labelBox = (await item.locator('.ant-dropdown-menu-title-content').boundingBox())!
    expect(iconBox.width).toBe(16)
    expect(iconBox.x + iconBox.width).toBeLessThanOrEqual(labelBox.x)
  }
  if (process.env.E2E_SHOT) await menu.screenshot({ path: process.env.E2E_SHOT })
})

test('левая панель: разделы и блоки под ними — скрыть, переставить, сохранить, вернуть', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signIn(page)
  const sidebar = page.getByTestId('sidebar-left')
  await expect(sidebar.getByRole('button', { name: 'Обсуждаемое' })).toBeVisible()
  await expect(sidebar.getByText('Актуальные теги')).toBeVisible()
  await expect(sidebar.getByRole('button').first()).toHaveText('Лента')

  await page.goto('/settings?tab=layout')
  const sections = page.getByTestId('layout-sidebar')
  const blocks = page.getByTestId('layout-blocks')
  await expect(sections.getByText('Топ аккаунтов')).toBeVisible({ timeout: 30_000 })

  await sections.getByRole('switch', { name: 'Показывать: Обсуждаемое' }).click()
  // «Справку» — наверх стрелками с клавиатуры.
  const helpHandle = sections.getByRole('button', { name: 'Переместить: Справка' })
  await helpHandle.focus()
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp')
  await expect(sections.getByRole('listitem').first()).toContainText('Справка')
  // Теги убрали, категории — над «Сначала лучшее».
  await blocks.getByRole('switch', { name: 'Показывать: Актуальные теги' }).click()
  await blocks.getByRole('button', { name: 'Переместить: Категории' }).focus()
  await page.keyboard.press('ArrowUp')
  await expect(blocks.getByRole('listitem').first()).toContainText('Категории')

  await page.goto('/')
  await expect(sidebar.getByRole('button').first()).toHaveText('Справка', { timeout: 30_000 })
  await expect(sidebar.getByRole('button', { name: 'Обсуждаемое' })).toHaveCount(0)
  await expect(sidebar.getByText('Актуальные теги')).toHaveCount(0)
  const categoriesY = (await sidebar.getByText('Категории').boundingBox())!.y
  expect(categoriesY).toBeLessThan((await sidebar.getByText('Сначала лучшее').boundingBox())!.y)

  // Переживает перезагрузку.
  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await expect(sidebar.getByRole('button').first()).toHaveText('Справка', { timeout: 30_000 })
  await expect(sidebar.getByText('Актуальные теги')).toHaveCount(0)

  await page.goto('/settings?tab=layout')
  await sections.getByRole('button', { name: 'Вернуть по умолчанию' }).click()
  await blocks.getByRole('button', { name: 'Вернуть по умолчанию' }).click()
  await page.goto('/')
  await expect(sidebar.getByRole('button').first()).toHaveText('Лента', { timeout: 30_000 })
  await expect(sidebar.getByRole('button', { name: 'Обсуждаемое' })).toBeVisible()
  await expect(sidebar.getByText('Актуальные теги')).toBeVisible()
})
