import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Телефон: уведомления — окном во весь экран, пост из ленты — окном, из окна —
 * страницей; шапка уезжает вслед за прокруткой; форма поста без лишних полей,
 * теги выбираются подряд, а с клавиатурой нижняя панель прячется.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const FIRST = 'a'.repeat(64)
const HEIGHT = 4_037_000
const STATUS_BAR = 32

const DATA: MockNodeData = {
  profiles: [
    { address: ME, name: 'me_ng' },
    { address: ALICE, name: 'alice_ng' },
  ],
  posts: Array.from({ length: 12 }, (_, i) => ({
    txid: i === 0 ? FIRST : String(i).padStart(2, '0').repeat(32),
    address: ALICE,
    message: `Пост номер ${i + 1}. ${'Строка текста, чтобы лента была длинной. '.repeat(4)}`,
    ago: 300 * (i + 1),
  })),
  comments: [],
  tags: ['bastyon', 'news', 'music', 'crypto', 'art'],
}

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

async function open(page: Page, path = '/'): Promise<void> {
  await useMockNode(page, DATA)
  await page.goto(path)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  // Строка состояния, как её передаёт MainActivity.
  await page.evaluate(
    (top) => document.documentElement.style.setProperty('--android-inset-top', `${top}px`),
    STATUS_BAR
  )
}

async function signIn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
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

const headerTop = (page: Page) =>
  page.locator('header').evaluate((el) => Math.round(el.getBoundingClientRect().top))

/** Сразу, без плавной прокрутки приложения: иначе шаги смешиваются. */
async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y)
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(y)
}

async function rect(locator: Locator): Promise<number[]> {
  const r = await locator.boundingBox()
  return [r?.x, r?.y, r?.width, r?.height].map((v) => Math.round(v ?? -1))
}

test('уведомления — окном во весь экран, а не выпадашкой', async ({ page }) => {
  await useMockNode(page, DATA)
  await page.route(/\.pocketnet\.app:8899\/.*getmissedinfo/, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        result: 'success',
        data: [
          { block: HEIGHT, contentsLang: {} },
          ...Array.from({ length: 15 }, (_, i) => ({
            mesType: 'subscribe',
            txid: String(i).padStart(2, '0').repeat(32),
            time: Math.floor(Date.now() / 1000) - 60 * (i + 1),
            nblock: HEIGHT - i - 1,
            addrFrom: ALICE,
          })),
        ],
      },
    })
  )
  await open(page)
  await signIn(page)

  await page.getByRole('banner').getByRole('button', { name: 'Уведомления' }).click()
  const sheet = page.locator('.notifications-modal .ant-modal-content')
  await expect(sheet.getByText('alice_ng').first()).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => rect(sheet)).toEqual([0, 0, 390, 844])
  await expect(page.locator('.header-notifications-dropdown')).toBeHidden()

  // Список прокручивается сам, страница под ним — нет.
  const list = sheet.locator('[data-styled-name="SC_NotificationsList"]')
  const overflow = await list.evaluate((el) => el.scrollHeight > el.clientHeight)
  expect(overflow).toBe(true)
  expect(await list.evaluate((el) => getComputedStyle(el).overscrollBehaviorY)).toBe('contain')
  // Заголовок окна — под строкой состояния.
  const title = await sheet.getByText('Уведомления', { exact: true }).boundingBox()
  expect(title!.y).toBeGreaterThanOrEqual(STATUS_BAR)

  await sheet.getByRole('button', { name: 'Закрыть' }).click()
  await expect(sheet).toBeHidden()
})

test('пост из ленты — окном, из окна — отдельной страницей', async ({ page }) => {
  await open(page)
  const first = page.locator('.post-card').filter({ hasText: 'Пост номер 1.' }).first()
  await expect(first).toBeVisible({ timeout: 30_000 })

  const time = first.getByTestId('post-time-link')
  await expect(time).toHaveAttribute('href', `/post/${FIRST}`)
  await time.click()
  const modal = page.locator('.ant-modal.post-modal')
  await expect(modal.getByText('Пост номер 1.')).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/')

  await modal.getByTestId('post-modal-open-page').click()
  await expect(page).toHaveURL(new RegExp(`/post/${FIRST}$`))
  await expect(modal).toBeHidden()
  await expect(page.locator('.post-card').filter({ hasText: 'Пост номер 1.' })).toBeVisible()

  // Прямая ссылка — сразу страница поста, без окна.
  await page.goto(`/post/${FIRST}`)
  await expect(page.locator('.post-card').filter({ hasText: 'Пост номер 1.' }).first()).toBeVisible(
    { timeout: 30_000 }
  )
  await expect(page.locator('.ant-modal.post-modal')).toHaveCount(0)
})

test('шапка уезжает вслед за прокруткой и возвращается без рывка', async ({ page }) => {
  await open(page)
  await expect(page.locator('.post-card').nth(5)).toBeVisible({ timeout: 30_000 })
  expect(await headerTop(page)).toBe(0)

  // У верха шапка уходит ровно на прокрутку: стык с лентой на месте.
  await scrollTo(page, 20)
  await expect.poll(() => headerTop(page)).toBe(-20)

  // Дальше её высоты — спрятана целиком, строка состояния закрыта фоном.
  await scrollTo(page, 600)
  await expect.poll(() => headerTop(page)).toBe(-(48 + STATUS_BAR))
  const shield = page.locator('[data-styled-name="SC_StatusBarShield"]')
  expect(await rect(shield)).toEqual([0, 0, 390, STATUS_BAR])

  // Чуть вверх — шапка выезжает и доезжает до конца сама.
  await scrollTo(page, 570)
  await expect.poll(() => headerTop(page)).toBe(0)

  // Вниз — снова уезжает; новая страница открывается с шапкой.
  await scrollTo(page, 900)
  await expect.poll(() => headerTop(page)).toBe(-(48 + STATUS_BAR))
  await go(page, '/search')
  await expect.poll(() => headerTop(page)).toBe(0)
})

test('форма поста: без лишних полей, теги подряд, клавиатура прячет панель', async ({ page }) => {
  await open(page)
  await signIn(page)
  await go(page, '/compose')

  const textarea = page.getByRole('textbox', { name: 'Что у вас нового?' })
  await expect(textarea).toBeVisible({ timeout: 30_000 })
  const [x, , width] = await rect(textarea)
  expect(x).toBe(12)
  expect(width).toBe(390 - 24)

  // Две подсказки подряд, не убирая фокус.
  const tags = page.getByRole('textbox', { name: 'Добавьте теги…' })
  await tags.click()
  const dropdown = page.locator('[data-styled-name="SC_Dropdown"]')
  await dropdown.getByText('#music').click()
  await expect(dropdown).toBeVisible()
  await dropdown.getByText('#crypto').click()
  const chips = page.locator('[data-styled-name="SC_TagChip"]')
  await expect(chips).toHaveText([/#music/, /#crypto/])
  await expect(tags).toBeFocused()

  // Клавиатура: видимая область ниже на её высоту, пока в фокусе поле.
  const nav = page
    .getByRole('navigation')
    .filter({ has: page.getByRole('button', { name: 'Чаты' }) })
  await expect(nav).toBeVisible()
  await textarea.focus()
  await page.setViewportSize({ width: 390, height: 500 })
  await expect(page.locator('html')).toHaveAttribute('data-keyboard', 'open')
  await expect(nav).toBeHidden()
  expect(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('#application > div:nth-child(2)')!).paddingBottom
    )
  ).toBe('0px')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('html')).not.toHaveAttribute('data-keyboard', 'open')
  await expect(nav).toBeVisible()
})
