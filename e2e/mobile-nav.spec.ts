import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Навигация на телефоне для гостя на подменной ноде: меню повторяет левую
 * панель компьютера, режим ленты открывается с любой страницы, «Кошелёк» и
 * «Чаты» просят войти, у поиска своё поле. Сеть не нужна, публикаций нет.
 */

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [{ txid: 'a'.repeat(64), address: ALICE.address, message: 'Пост для проверки меню' }],
}

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

async function open(page: Page, path: string) {
  await useMockNode(page, DATA)
  await page.goto(path)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  // Чистый профиль — первый запуск: «Что нового» перекрывает страницу.
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

const menu = (page: Page) => page.locator('aside[aria-hidden="false"]')
const bottomNav = (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('button', { name, exact: true })

test.describe('Навигация на телефоне', () => {
  test('меню повторяет левую панель компьютера', async ({ page }) => {
    await open(page, '/')
    await page.getByRole('button', { name: 'Меню' }).click()
    for (const item of [
      'Лента',
      'Подписки',
      'Видео',
      'Статьи',
      'Блокчейн-обозреватель',
      'Справка',
    ]) {
      await expect(menu(page).getByRole('button', { name: item, exact: true })).toBeVisible()
    }
    await expect(menu(page).getByText('Категории')).toBeVisible()
    await expect(menu(page).getByRole('button', { name: 'Войти' })).toBeVisible()
  })

  test('режим ленты из меню открывает ленту с любой страницы', async ({ page }) => {
    await open(page, '/search?q=море')
    await page.getByRole('button', { name: 'Меню' }).click()
    await menu(page).getByRole('button', { name: 'Статьи', exact: true }).click()
    await expect(page).toHaveURL(/\/\?feedMode=article$/)
    await expect(menu(page)).toHaveCount(0)
  })

  for (const item of ['Кошелёк', 'Чаты']) {
    test(`гостю «${item}» предлагает войти, а не уводит на ленту`, async ({ page }) => {
      await open(page, '/search')
      await bottomNav(page, item).click()
      await expect(page.getByRole('dialog', { name: 'Вход в аккаунт' })).toBeVisible()
      await expect(page).toHaveURL(/\/search$/)
    })
  }

  test('у поиска на телефоне своё поле', async ({ page }) => {
    await open(page, '/search')
    const field = page.getByPlaceholder('Поиск...')
    await expect(field).toBeFocused()
    await field.fill('море')
    await field.press('Enter')
    await expect(page).toHaveURL(/\/search\?q=%D0%BC%D0%BE%D1%80%D0%B5$/)
  })

  test('«Назад» в шапке — когда есть куда вернуться', async ({ page }) => {
    await open(page, '/')
    const back = page.getByTestId('history-back')
    await expect(back).toHaveCount(0)
    await bottomNav(page, 'Поиск').click()
    await expect(page).toHaveURL(/\/search$/)
    await expect(page.getByTestId('history-forward')).toHaveCount(0)
    await back.click()
    await expect(page).toHaveURL(/\/$/)
    await expect(back).toHaveCount(0)
  })
})

/**
 * С аккаунтом: пункты аккаунта — только в меню аватара, в боковом меню их нет.
 * Нажатие мимо открытого меню аватара только закрывает его — до кнопки под
 * ним (здесь «Поиск» в нижней панели) оно не доходит.
 */
test.describe('Телефон с аккаунтом', () => {
  const MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  const ME = { address: 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy', name: 'me_ng' }

  async function signIn(page: Page): Promise<void> {
    await useMockNode(page, { profiles: [ME], posts: [], comments: [] })
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

  const accountMenu = (page: Page) => page.locator('.header-user-dropdown')

  test('пункты аккаунта — в меню аватара, а не в боковом меню', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Меню' }).click()
    await expect(menu(page).getByRole('button', { name: 'Лента', exact: true })).toBeVisible()
    for (const item of ['Профиль', 'Кошельки', 'Настройки']) {
      await expect(menu(page).getByRole('button', { name: item, exact: true })).toHaveCount(0)
    }
    await menu(page).getByRole('button', { name: 'Закрыть' }).click()
    await expect(menu(page)).toHaveCount(0)

    await page.locator('[data-header-avatar]').click()
    for (const item of ['Профиль', 'Кошельки', 'Настройки']) {
      await expect(accountMenu(page).getByRole('menuitem', { name: item })).toBeVisible()
    }
  })

  test('нажатие мимо меню аватара только закрывает его', async ({ page }) => {
    await signIn(page)
    await page.locator('[data-header-avatar]').click()
    await expect(accountMenu(page)).toBeVisible()
    await bottomNav(page, 'Поиск').tap()
    await expect(accountMenu(page)).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
    // Меню закрыто — та же кнопка работает как обычно.
    await bottomNav(page, 'Поиск').tap()
    await expect(page).toHaveURL(/\/search$/)
  })
})

/**
 * Телефон боком (data-shell="rail"): каркас телефона, но разделы — колонкой
 * слева, шапка ниже, окна не выше экрана. 844×390 — iPhone 14 боком: шире
 * 768 px, и по одной ширине приложение раньше считало его компьютером.
 */
test.describe('Телефон боком', () => {
  test.use({ viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 } })

  test('разделы колонкой слева, шапка ниже, вбок не прокручивается', async ({ page }) => {
    await open(page, '/')
    const rail = page
      .getByRole('navigation')
      .filter({ has: page.getByRole('button', { name: 'Главная' }) })
    const box = await rail.boundingBox()
    expect(box).toMatchObject({ x: 0, y: 48, width: 64 })
    await expect(page.getByRole('button', { name: 'Меню' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844)

    await bottomNav(page, 'Поиск').click()
    await expect(page).toHaveURL(/\/search$/)
  })

  test('окно входа целиком на экране', async ({ page }) => {
    await open(page, '/search')
    await bottomNav(page, 'Кошелёк').click()
    const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
    await expect(dialog).toBeVisible()
    const box = await page.locator('.ant-modal-content').boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(390)
  })
})
