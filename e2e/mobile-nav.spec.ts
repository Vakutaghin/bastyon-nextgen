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
    for (const item of ['Лента', 'Подписки', 'Видео', 'Статьи', 'Эксплорер', 'Справка']) {
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
})
