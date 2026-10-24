import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Каркас телефона: шапка (логотип слева от меню), нижняя панель в порядке
 * «Главная, Поиск, Чаты, Кошелёк, Сервисы», футера нет, заголовки страниц не
 * уходят под шапку со строкой состояния Android, поле комментария растёт до
 * семи строк, межстрочный интервал плотнее, чем на компьютере.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const TXID = 'b'.repeat(64)
const DATA: MockNodeData = {
  profiles: [{ address: ME, name: 'me_ng' }],
  posts: [{ txid: TXID, address: ME, message: 'Мой пост', ago: 300 }],
  comments: [],
}

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

async function signIn(page: Page): Promise<void> {
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
  // Строка состояния и жесты, как их передаёт MainActivity.
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--android-inset-top', '32px')
    document.documentElement.style.setProperty('--android-inset-bottom', '24px')
  })
}

/** Без перезагрузки: page.goto под нагрузкой снова показывал «Что нового». */
async function go(page: Page, path: string): Promise<void> {
  await page.evaluate(
    (p) =>
      (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $router: { push(p: string): void } } } }
        }
      ).__vue_app__.config.globalProperties.$router.push(p),
    path
  )
}

const headerBottom = (page: Page) =>
  page.locator('header').evaluate((el) => el.getBoundingClientRect().bottom)

test('шапка, нижняя панель и футер', async ({ page }) => {
  await signIn(page)

  // Шапка 48px под строкой состояния; логотип — левее кнопки меню.
  expect(await headerBottom(page)).toBe(32 + 48)
  const logo = await page.locator('header [data-styled-name="SC_LogoLink"]').boundingBox()
  const menu = await page.getByRole('button', { name: 'Меню' }).boundingBox()
  expect(logo!.x).toBeLessThan(menu!.x)
  // Флага языка в шапке телефона нет: язык — в «Настройках».
  await expect(page.locator('header [data-styled-name="SC_LogoLang"]')).toHaveCount(0)

  const nav = page
    .getByRole('navigation')
    .filter({ has: page.getByRole('button', { name: 'Чаты' }) })
  await expect(nav.getByRole('button')).toHaveText([
    'Главная',
    'Поиск',
    'Чаты',
    'Кошелёк',
    'Сервисы',
  ])
  // Под подписями — 5–6 px до края панели, а не 11.
  const gap = await nav.evaluate((el) => {
    const label = el.querySelector('button > span:last-child')!.getBoundingClientRect()
    const safe = parseFloat(getComputedStyle(el).paddingBottom)
    return el.getBoundingClientRect().bottom - safe - label.bottom
  })
  expect(gap).toBeGreaterThanOrEqual(4)
  expect(gap).toBeLessThanOrEqual(7)

  await expect(page.getByText('децентрализованная социальная сеть')).toHaveCount(0)
})

test('заголовки страниц не уходят под шапку', async ({ page }) => {
  await signIn(page)
  const cases: Array<[string, () => ReturnType<Page['locator']>]> = [
    ['/wallets', () => page.getByRole('heading', { name: 'Кошельки', level: 1 })],
    [`/post/${TXID}`, () => page.locator('.post-card').first()],
    ['/compose', () => page.getByText('Новый пост').first()],
  ]
  for (const [path, target] of cases) {
    await go(page, path)
    const el = target()
    await expect(el).toBeVisible({ timeout: 15_000 })
    await page.evaluate(() => window.scrollTo(0, 0))
    const top = await el.evaluate((node) => node.getBoundingClientRect().top)
    expect(top, path).toBeGreaterThanOrEqual(await headerBottom(page))
  }
})

test('поле комментария: 14px, растёт до семи строк, потом прокрутка', async ({ page }) => {
  await signIn(page)
  await go(page, `/post/${TXID}`)
  const field = page.locator('textarea').first()
  await expect(field).toBeVisible({ timeout: 15_000 })
  const style = await field.evaluate((el) => {
    const cs = getComputedStyle(el)
    return [cs.fontSize, cs.lineHeight]
  })
  expect(style).toEqual(['14px', '18px'])

  const height = () => field.evaluate((el) => el.getBoundingClientRect().height)
  await field.fill('одна строка')
  const one = await height()
  await field.fill(Array.from({ length: 4 }, (_, i) => `строка ${i}`).join('\n'))
  expect(await height()).toBe(4 * 18 + 16)
  await field.fill(Array.from({ length: 12 }, (_, i) => `строка ${i}`).join('\n'))
  // Семь строк, остальное прокручивается.
  expect(await height()).toBe(7 * 18 + 16)
  expect(await field.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
  await field.fill('коротко')
  expect(await height()).toBe(one)
})

test('межстрочный интервал на телефоне плотнее', async ({ page }) => {
  await signIn(page)
  const lineHeight = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).lineHeight)
  )
  // 16px × 1.4 на компьютере; на телефоне множитель 0.93.
  expect(lineHeight).toBeCloseTo(16 * 1.4 * 0.93, 1)
})
