import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «Что нового» листается к прежним версиям, вся история — книга справки
 * «История версий». Отметки аккаунта в профиле — цветные, по нажатию
 * подсказка со ссылкой на справку; значок на аватаре — в левом верхнем углу.
 */

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const DATA: MockNodeData = {
  profiles: [{ address: ALICE, name: 'alice_ng', reputation: 150, badges: ['moderator', 'shark'] }],
  posts: [{ txid: 'a'.repeat(64), address: ALICE, message: 'Пост Алисы', ago: 600 }],
  comments: [],
}

const CURRENT = `v${(JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version}`

async function start(page: Page): Promise<void> {
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
}

/** Переход внутри приложения, без перезагрузки страницы. */
function go(page: Page, path: string): Promise<unknown> {
  return page.evaluate((to) => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $router: { push: (p: string) => unknown } } } }
      }
    ).__vue_app__
    return app.config.globalProperties.$router.push(to)
  }, path)
}

/**
 * Закрыть «Что нового» и перейти: `page.goto` перезагрузил бы страницу раньше,
 * чем приложение запомнит закрытие, и окно всплыло бы снова.
 */
async function dismissAndGo(page: Page, path: string): Promise<void> {
  const ok = page.getByRole('button', { name: 'Понятно' })
  await ok.click({ timeout: 30_000 })
  await expect(ok).toBeHidden()
  await go(page, path)
}

/** Цвет CSS-переменной в текущей теме — как его посчитает браузер. */
function cssColor(page: Page, name: string): Promise<string> {
  return page.evaluate((v) => {
    const el = document.createElement('i')
    el.style.color = `var(${v})`
    document.body.append(el)
    const color = getComputedStyle(el).color
    el.remove()
    return color
  }, name)
}

test('«Что нового» листается к прежним версиям и ведёт в историю версий', async ({ page }) => {
  await start(page)
  const dialog = page.getByRole('dialog', { name: `Что нового — ${CURRENT}` })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('whats-new-newer')).toBeDisabled()

  const older = page.getByTestId('whats-new-older')
  const previous = (await older.innerText()).trim()
  expect(previous).toMatch(/^v\d+\.\d+\.\d+$/)
  await older.click()
  await expect(page.getByRole('dialog', { name: `Что нового — ${previous}` })).toBeVisible()
  await expect(page.getByTestId('whats-new-body')).toContainText(previous)
  await expect(page.getByTestId('whats-new-newer')).toHaveText(CURRENT)
  await page.getByTestId('whats-new-newer').click()
  await expect(dialog).toBeVisible()

  // Вся история — книга справки в боковой панели, со списком версий.
  await page.getByTestId('whats-new-all').click()
  await expect(dialog).toBeHidden()
  const panel = page.locator('.ant-drawer-content')
  await expect(panel.getByRole('heading', { level: 1, name: 'История версий' })).toBeVisible({
    timeout: 15_000,
  })
  const versions = panel.getByRole('link', { name: /^v\d+\.\d+\.\d+ — / })
  expect(await versions.count()).toBeGreaterThan(20)
  await expect(versions.first()).toContainText(CURRENT)
  await panel
    .getByRole('link', { name: new RegExp(`^${previous.replace(/\./g, '\\.')} — `) })
    .click()
  await expect(panel.getByRole('heading', { level: 1 })).toContainText(previous)
})

test('справка: книга «История версий» на главной — первые версии и «Ещё N»', async ({ page }) => {
  await start(page)
  await dismissAndGo(page, '/help')
  // Карточка книги на главной: первые версии и ссылка на всю книгу.
  const book = page.locator('[data-styled-name="SC_Book"]').filter({
    has: page.locator('[data-styled-name="SC_BookTitle"]', { hasText: 'История версий' }),
  })
  await expect(book).toBeVisible({ timeout: 30_000 })
  await expect(book.getByRole('link', { name: /^v\d+\.\d+\.\d+ — / })).toHaveCount(8)
  await expect(book.getByRole('link', { name: /^Ещё \d+$/ })).toBeVisible()
  await go(page, '/help/releases')
  await expect(page.getByRole('heading', { level: 1, name: 'История версий' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page
      .locator('[data-styled-name="SC_Article"]')
      .getByRole('link', { name: new RegExp(`^${CURRENT} — `) })
  ).toBeVisible()
})

test('отметки в профиле: цвет, подсказка и справка; значок на аватаре слева вверху', async ({
  page,
}) => {
  await start(page)
  await dismissAndGo(page, `/${ALICE}`)

  const badges = page.getByTestId('profile-badges').filter({ visible: true })
  await expect(badges).toBeVisible({ timeout: 30_000 })
  await expect(badges.locator('[data-badge]')).toHaveText(['Модератор', 'Акула', 'Авторитетный'])
  // У каждой отметки свой цвет текста — из своей переменной темы.
  for (const [badge, token] of [
    ['moderator', '--ui-mark-moderator-text'],
    ['shark', '--ui-mark-shark-text'],
    ['established', '--ui-mark-established-text'],
  ] as const) {
    await expect(badges.locator(`[data-badge="${badge}"]`)).toHaveCSS(
      'color',
      await cssColor(page, token)
    )
  }

  await badges.locator('[data-badge="shark"]').click()
  const hint = page.getByTestId('badge-hint-shark')
  await expect(hint).toBeVisible()
  await expect(hint).toContainText('Только оценки «акул» меняют репутацию авторов')
  await hint.getByRole('button', { name: 'Подробнее в справке' }).click()
  await expect(hint).toBeHidden()
  const panel = page.locator('.ant-drawer-content').filter({ hasText: 'Отметки аккаунтов' })
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await expect(panel.getByRole('heading', { name: 'Акула' })).toBeVisible()
  await page.keyboard.press('Escape')

  // Значок на аватаре в шапке поста: корона модератора в левом верхнем углу.
  const post = page.locator('.post-card').filter({ hasText: 'Пост Алисы' }).first()
  await expect(post).toBeVisible({ timeout: 30_000 })
  const mark = post.locator('[data-mark="moderator"]').first()
  await expect(mark).toBeVisible()
  await expect(mark).toHaveCSS('background-color', await cssColor(page, '--ui-mark-moderator'))
  const avatar = (await mark.locator('xpath=..').boundingBox())!
  const box = (await mark.boundingBox())!
  expect(box.x - avatar.x).toBeLessThan(4)
  expect(box.y - avatar.y).toBeLessThan(4)
})

test.describe('на телефоне', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('отметки — в шапке профиля, подсказка по нажатию', async ({ page }) => {
    await start(page)
    await dismissAndGo(page, `/${ALICE}`)
    const header = page.getByTestId('profile-mobile-header')
    const badges = header.getByTestId('profile-badges')
    await expect(badges).toBeVisible({ timeout: 30_000 })
    await expect(badges.locator('[data-badge]')).toHaveText(['Модератор', 'Акула', 'Авторитетный'])
    await badges.locator('[data-badge="moderator"]').tap()
    await expect(page.getByTestId('badge-hint-moderator')).toContainText('жюри по жалобам')
    // Подсказка помещается в экран.
    const hint = (await page.getByTestId('badge-hint-moderator').boundingBox())!
    expect(hint.x).toBeGreaterThanOrEqual(0)
    expect(hint.x + hint.width).toBeLessThanOrEqual(390)
  })
})
