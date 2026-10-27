import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Профиль на телефоне: боковой колонки нет, главное из неё — в шапке над
 * постами (счётчики, начало «О себе», кнопки), остальное — в «Подробнее»,
 * шторкой снизу. На своей странице — «Редактировать профиль».
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const ABOUT = [
  'Пишу про горы и велосипеды.',
  'Летом — Алтай, зимой — Хибины.',
  'Снимаю на плёнку, проявляю сама.',
  'Последняя строка о себе: www.example.org',
].join('\n')

const DATA: MockNodeData = {
  profiles: [
    { address: ME, name: 'me_ng' },
    {
      address: ALICE,
      name: 'alice_ng',
      reputation: 345.67,
      about: ABOUT,
      site: 'alice.example.org',
      subscribers: [BOB],
    },
    { address: BOB, name: 'bob_ng' },
  ],
  posts: [{ txid: 'a'.repeat(64), address: ALICE, message: 'Пост Алисы', ago: 600 }],
  comments: [],
}

const VIEWPORT = { width: 390, height: 844 }
test.use({ viewport: VIEWPORT, isMobile: true, hasTouch: true })

async function signedIn(page: Page): Promise<void> {
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

/** Escape — когда фокус уже в окне: antd переводит его туда после анимации. */
async function closeSheet(page: Page, sheet: Locator): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => !!document.activeElement?.closest('.ant-modal-wrap')))
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
}

test('чужой профиль: счётчики и начало «О себе» в шапке, остальное — в «Подробнее»', async ({
  page,
}) => {
  await signedIn(page)
  await go(page, `/${ALICE}`)
  const header = page.getByTestId('profile-mobile-header')
  await expect(header).toBeVisible({ timeout: 30_000 })

  await expect(header).toContainText('Репутация')
  await expect(header).toContainText('345.7')
  await expect(header.getByTestId('profile-followers')).toContainText('2')
  await expect(header.getByTestId('profile-following')).toContainText('1')
  await expect(header.getByRole('button', { name: 'Включить уведомления' })).toBeVisible()

  // Счётчики — в одну строку, страница не шире экрана.
  const tops = await header
    .getByText(/^(Репутация|Подписчики|Подписки)$/)
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    VIEWPORT.width
  )

  // «О себе» — три строки, длинное обрезано.
  const about = header.getByTestId('profile-about')
  await expect(about).toContainText('Пишу про горы')
  expect(
    await about.evaluate((el) => el.scrollHeight > el.clientHeight + 2),
    'четыре строки обрезаны до трёх'
  ).toBe(true)

  await header.getByTestId('profile-more').click()
  const sheet = page.getByRole('dialog', { name: 'alice_ng' })
  await expect(sheet).toBeVisible()
  const details = sheet.getByTestId('profile-details')
  await expect(details).toContainText('Последняя строка о себе')
  await expect(details.getByRole('link', { name: 'www.example.org' })).toBeVisible()
  await expect(details).toContainText(ALICE)
  await expect(details.getByRole('link', { name: 'В блокчейне' })).toBeVisible()
  await expect(details.getByRole('link', { name: 'https://alice.example.org' })).toBeVisible()
  await expect(details).toContainText('Публикации:')
  await expect(details).toContainText('Регистрация:')
  await expect(sheet.getByRole('button', { name: 'Заблокировать' })).toBeVisible()

  // Шторка — снизу во всю ширину, профиль над ней виден. Замер — после
  // анимации открытия.
  const content = page.locator('.profile-info-modal .ant-modal-content')
  await expect.poll(async () => Math.round((await content.boundingBox())!.x)).toBe(0)
  const box = (await content.boundingBox())!
  expect(Math.round(box.width)).toBe(VIEWPORT.width)
  expect(Math.abs(box.y + box.height - VIEWPORT.height)).toBeLessThanOrEqual(1)
  expect(box.y).toBeGreaterThan(48)

  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(sheet).toBeHidden()

  // Нажатие на «О себе» тоже открывает «Подробнее».
  await about.click()
  await expect(sheet).toBeVisible()
  await closeSheet(page, sheet)

  await header.getByTestId('profile-followers').click()
  const list = page.getByRole('dialog', { name: 'Подписчики' })
  await expect(list).toContainText('bob_ng', { timeout: 30_000 })
})

test('свой профиль: «Редактировать профиль» на телефоне, без «Заблокировать»', async ({ page }) => {
  await signedIn(page)
  await go(page, `/${ME}`)
  const header = page.getByTestId('profile-mobile-header')
  await expect(header).toBeVisible({ timeout: 30_000 })
  await expect(header.getByRole('button', { name: 'Подписаться' })).toHaveCount(0)
  await expect(header.getByTestId('profile-about')).toHaveCount(0)

  await header.getByTestId('profile-more').click()
  const sheet = page.getByRole('dialog', { name: 'me_ng' })
  await expect(sheet.getByTestId('profile-details')).toContainText(ME)
  await expect(sheet.getByRole('button', { name: 'Заблокировать' })).toHaveCount(0)
  await closeSheet(page, sheet)

  await header.getByTestId('profile-edit').click()
  await expect(page.getByRole('dialog', { name: 'Редактировать профиль' })).toBeVisible()
})
