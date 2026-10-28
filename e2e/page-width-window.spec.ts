import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Ширина страницы: кнопка в шапке, настройка в «Общих», кнопку можно скрыть.
 * Окно приложения для компьютера (Настройки → «Система»): крестик на Windows
 * и Linux, значок в строке меню на macOS — команды Rust подменены
 * `__TAURI_INTERNALS__`. Нода подменная.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const DATA: MockNodeData = { profiles: [], posts: [], comments: [] }

async function open(page: Page, path: string): Promise<void> {
  await useMockNode(page, DATA)
  await page.goto(path)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

async function signIn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

/** Переход внутри приложения: без перезагрузки и без нового входа. */
async function goTo(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    const el = document.querySelector('#app') as unknown as {
      __vue_app__: {
        config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
      }
    }
    return el.__vue_app__.config.globalProperties.$router.push(to)
  }, path)
}

const pageWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.getAttribute('data-page-width'))

/** Ширина полосы шапки с логотипом, поиском и значками. */
const headerWidth = (page: Page) =>
  page.evaluate(() => {
    const logo = document.querySelector('header img, header svg')
    const row = logo?.closest('header > div')
    return row ? row.getBoundingClientRect().width : 0
  })

test('ширина страницы: кнопка в шапке, «Общие», кнопку можно скрыть', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1700, height: 900 })
  await open(page, '/')

  // По умолчанию — во всю ширину.
  expect(await pageWidth(page)).toBe('full')
  expect(await headerWidth(page)).toBeGreaterThan(1600)

  const toggle = page.getByTestId('header-page-width')
  await expect(toggle).toHaveAttribute('aria-label', 'Ограничить ширину')
  await toggle.click()
  expect(await pageWidth(page)).toBe('limited')
  await expect.poll(() => headerWidth(page)).toBeLessThanOrEqual(1280)
  await expect(toggle).toHaveAttribute('aria-label', 'Во всю ширину')

  // Переживает перезагрузку и стоит до появления приложения.
  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  expect(await pageWidth(page)).toBe('limited')

  await signIn(page)
  await goTo(page, '/settings')
  await page.getByRole('button', { name: 'Общие' }).click()
  const widthRow = page.getByTestId('page-width-setting')
  await expect(widthRow.getByRole('button', { name: 'Ограниченная' })).toBeVisible()
  await widthRow.getByRole('button', { name: 'Во всю ширину' }).click()
  expect(await pageWidth(page)).toBe('full')

  // Кнопку в шапке скрывает переключатель в «Общих».
  await expect(page.getByTestId('header-page-width')).toBeVisible()
  await page.getByRole('switch', { name: 'Кнопка в шапке' }).click()
  await expect(page.getByTestId('header-page-width')).toHaveCount(0)
  await page.getByRole('switch', { name: 'Кнопка в шапке' }).click()
  await expect(page.getByTestId('header-page-width')).toBeVisible()

  // Окно уже колонки — переключать нечего, кнопки нет.
  await page.setViewportSize({ width: 1100, height: 900 })
  await expect(page.getByTestId('header-page-width')).toBeHidden()
})

declare global {
  interface Window {
    __desktopPrefsCalls?: { cmd: string; args: unknown }[]
  }
}

/** Подменные команды Rust: настройки окна для платформы, остальное — пусто. */
async function fakeDesktop(page: Page, platform: 'windows' | 'macos'): Promise<void> {
  await page.evaluate((os) => {
    const calls: { cmd: string; args: unknown }[] = []
    window.__desktopPrefsCalls = calls
    let view = { closeToTray: true, menuBarIcon: true, platform: os, trayAvailable: true }
    let next = 1
    const internals = {
      transformCallback: () => next++,
      unregisterCallback: () => {},
      async invoke(cmd: string, args: Record<string, unknown> = {}) {
        calls.push({ cmd, args })
        if (cmd === 'desktop_prefs_get') return view
        if (cmd === 'desktop_prefs_set') {
          view = { ...view, ...(args.prefs as object) }
          return view
        }
        return null
      },
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    }
    Object.assign(window, { __TAURI_INTERNALS__: internals })
  }, platform)
}

const prefsSets = (page: Page) =>
  page.evaluate(() =>
    (window.__desktopPrefsCalls ?? [])
      .filter((c) => c.cmd === 'desktop_prefs_set')
      .map((c) => (c.args as { prefs: unknown }).prefs)
  )

test('«Система»: крестик на Windows — в трей или выход', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await open(page, '/')
  await signIn(page)
  // Подмена — после входа: с ней запросы приложения пошли бы через плагин http Tauri.
  await fakeDesktop(page, 'windows')
  await goTo(page, '/settings')
  await page.getByRole('button', { name: 'Система' }).click()

  const row = page.getByTestId('close-action')
  await expect(row).toContainText('При закрытии окна')
  await expect(page.getByTestId('menu-bar-icon')).toHaveCount(0)
  await row.getByRole('button', { name: 'Закрывать приложение' }).click()
  await expect.poll(() => prefsSets(page)).toEqual([{ closeToTray: false, menuBarIcon: true }])
})

test('«Система»: значок в строке меню на macOS', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await open(page, '/')
  await signIn(page)
  await fakeDesktop(page, 'macos')
  await goTo(page, '/settings')
  await page.getByRole('button', { name: 'Система' }).click()

  await expect(page.getByTestId('close-action')).toHaveCount(0)
  const icon = page.getByRole('switch', { name: 'Значок в строке меню' })
  await expect(icon).toBeChecked()
  await icon.click()
  await expect(icon).not.toBeChecked()
  await expect.poll(() => prefsSets(page)).toEqual([{ closeToTray: true, menuBarIcon: false }])
})
