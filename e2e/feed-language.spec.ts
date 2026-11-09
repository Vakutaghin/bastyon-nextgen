import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Язык ленты — отдельно от языка интерфейса: «Язык ленты» под «Сначала
 * лучшее» меняет только ленту, а язык из шапки переключает и интерфейс, и
 * ленту. Языков можно выбрать несколько — лента спрашивает ноду о каждом.
 * Язык ленты виден по запросу к ноде. Нода подменная.
 */

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const DATA: MockNodeData = {
  profiles: [{ address: ALICE, name: 'alice_ng' }],
  posts: [{ txid: 'a'.repeat(64), address: ALICE, message: 'Пост в ленте', ago: 300 }],
  comments: [],
}

/** «Что нового» этой версии уже видели (use-changelog.ts): окно не встанет поверх ленты. */
const APP_VERSION = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
  .version

/** Языки, с которыми лента спрашивала ноду (`gethistoricalstrip`, 4-й параметр). */
function watchFeedLanguages(page: Page): string[] {
  const langs: string[] = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/gethistoricalstrip')) return
    try {
      const params = (request.postDataJSON() as { parameters?: unknown[] })?.parameters
      if (typeof params?.[3] === 'string') langs.push(params[3])
    } catch {
      // не JSON — не наш запрос
    }
  })
  return langs
}

test('язык ленты меняет только ленту, язык из шапки — и интерфейс, и ленту', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  const langs = watchFeedLanguages(page)
  await useMockNode(page, DATA)
  await page.addInitScript((version) => {
    if (!localStorage.getItem('bastyon_locale')) localStorage.setItem('bastyon_locale', 'ru')
    localStorage.setItem('bastyonChangelogLastSeenVersion', version)
  }, APP_VERSION)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await expect(page.getByText('Пост в ленте')).toBeVisible({ timeout: 30_000 })
  expect(langs.at(-1)).toBe('ru')

  // Лента — на английском, интерфейс остаётся русским.
  // Поле подписано «Язык ленты». Открывается и нажатием на стрелку: раньше
  // она перехватывала нажатие, и список не открывался. Мышью в точку стрелки,
  // а не click() по ней: тот сам выбрал бы элемент.
  await expect(page.getByLabel('Язык ленты')).toBeVisible()
  const field = page.locator('.ant-select', { has: page.getByLabel('Язык ленты') })
  const box = (await field.locator('.ant-select-arrow').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  // В списке отмечают несколько языков: English — добавить, «Русский» — снять.
  await page.locator('.ant-select-item-option', { hasText: 'English' }).click()
  await page.locator('.ant-select-item-option', { hasText: 'Русский' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('feed-languages')).toContainText('English')
  await expect.poll(() => langs.at(-1)).toBe('en')
  await expect(page.getByText('Сначала лучшее')).toBeVisible()

  // После перезапуска лента помнит свой язык.
  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await expect(page.getByText('Пост в ленте')).toBeVisible({ timeout: 30_000 })
  expect(langs.at(-1)).toBe('en')
  await expect(page.getByText('Сначала лучшее')).toBeVisible()

  // Язык в шапке — и интерфейс, и лента на немецком.
  await page.getByRole('button', { name: 'Язык: Русский' }).click()
  await page.getByRole('menuitem', { name: 'Deutsch' }).click()
  await expect(page.getByText('Beste zuerst')).toBeVisible()
  await expect.poll(() => langs.at(-1)).toBe('de')
  await expect(page.getByTestId('feed-languages')).toContainText('Deutsch')
})

test('несколько языков: лента спрашивает ноду о каждом и ставит посты по времени', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  const langs = watchFeedLanguages(page)
  await useMockNode(page, {
    profiles: [{ address: ALICE, name: 'alice_ng' }],
    posts: [
      {
        txid: 'a'.repeat(64),
        address: ALICE,
        message: 'Свежий по-русски',
        language: 'ru',
        ago: 60,
      },
      {
        txid: 'b'.repeat(64),
        address: ALICE,
        message: 'Fresh in English',
        language: 'en',
        ago: 120,
      },
      {
        txid: 'c'.repeat(64),
        address: ALICE,
        message: 'Старый по-русски',
        language: 'ru',
        ago: 600,
      },
      {
        txid: 'd'.repeat(64),
        address: ALICE,
        message: 'Frisch auf Deutsch',
        language: 'de',
        ago: 300,
      },
    ],
    comments: [],
  })
  await page.addInitScript((version) => {
    if (!localStorage.getItem('bastyon_locale')) localStorage.setItem('bastyon_locale', 'ru')
    localStorage.setItem('bastyonChangelogLastSeenVersion', version)
    if (!localStorage.getItem('bastyon_feed_locale'))
      localStorage.setItem('bastyon_feed_locale', 'ru,en')
  }, APP_VERSION)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  const feed = page.locator('main')
  await expect(feed.getByText('Fresh in English')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('feed-languages')).toContainText('RU, EN')
  expect(langs).toEqual(expect.arrayContaining(['ru', 'en']))
  expect(langs).not.toContain('de')
  await expect(feed.getByText('Frisch auf Deutsch')).toHaveCount(0)

  // По времени вперемешку: свежий русский, английский, старый русский.
  const top = async (text: string) => (await feed.getByText(text).boundingBox())!.y
  expect(await top('Свежий по-русски')).toBeLessThan(await top('Fresh in English'))
  expect(await top('Fresh in English')).toBeLessThan(await top('Старый по-русски'))
})

test('подписки — на всех языках, общая лента, новое от подписок и комментарии — на языке ленты', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  const BOB = 'PBobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
  const comments: string[] = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/getlastcomments')) return
    const params = (request.postDataJSON() as { parameters?: unknown[] })?.parameters
    if (typeof params?.[2] === 'string') comments.push(params[2])
  })
  await useMockNode(page, {
    profiles: [
      { address: ME, name: 'me_ng' },
      { address: ALICE, name: 'alice_ng' },
      { address: BOB, name: 'bob_ng' },
    ],
    posts: [
      {
        txid: 'a'.repeat(64),
        address: ALICE,
        message: 'Алиса пишет по-русски',
        language: 'ru',
        ago: 60,
      },
      {
        txid: 'd'.repeat(64),
        address: ALICE,
        message: 'Alice writes in English',
        language: 'en',
        ago: 90,
      },
      {
        txid: 'b'.repeat(64),
        address: BOB,
        message: 'Bob writes in English',
        language: 'en',
        ago: 120,
      },
      { txid: 'c'.repeat(64), address: BOB, message: 'Боб и по-русски', language: 'ru', ago: 180 },
    ],
    comments: [],
    subscribes: [ALICE],
  })
  await page.route('**/_matrix/**', (route) => route.abort())
  await page.addInitScript(() => {
    if (!localStorage.getItem('bastyon_locale')) localStorage.setItem('bastyon_locale', 'ru')
    if (!localStorage.getItem('bastyon_feed_locale'))
      localStorage.setItem('bastyon_feed_locale', 'en')
  })
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const auth = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await auth
    .locator('input, textarea')
    .first()
    .fill(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    )
  await auth.getByRole('button', { name: 'Войти' }).click()
  await expect(auth).toBeHidden({ timeout: 30_000 })

  // Лента на английском: и новое от подписок наверху — только по-английски.
  // Русский пост Алисы там раньше стоял первым, и лента «оставалась русской».
  // Подборка держится и после перезапроса всего, что идёт сразу за входом.
  const feed = page.locator('main')
  await expect(feed.getByText('Bob writes in English')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('feed-subscriptions-divider')).toBeVisible({ timeout: 30_000 })
  await expect(feed.getByText('Alice writes in English').first()).toBeVisible()
  await page.waitForTimeout(3_000)
  await expect(feed.getByText('Alice writes in English').first()).toBeVisible()
  await expect(feed.getByText('Алиса пишет по-русски')).toHaveCount(0)
  await expect(feed.getByText('Боб и по-русски')).toHaveCount(0)
  await expect.poll(() => comments.at(-1)).toBe('en')

  // «Подписки» — все языки: русский пост Алисы виден, английский Боба — нет, он не в подписках.
  await page.getByRole('navigation').getByRole('button', { name: 'Подписки' }).click()
  await expect(page).toHaveURL(/feedMode=subscriptions/)
  await expect(feed.getByText('Алиса пишет по-русски')).toBeVisible({ timeout: 30_000 })
  await expect(feed.getByText('Bob writes in English')).toHaveCount(0)
})

test('язык ленты в меню телефона: список открывается поверх меню', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  const langs = watchFeedLanguages(page)
  await useMockNode(page, DATA)
  await page.addInitScript(() => {
    if (!localStorage.getItem('bastyon_locale')) localStorage.setItem('bastyon_locale', 'ru')
  })
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await expect(page.getByText('Пост в ленте')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: /меню/i }).first().click()
  const field = page.locator('.ant-select', { has: page.getByLabel('Язык ленты') })
  await field.scrollIntoViewIfNeeded()
  await field.click()
  await page.locator('.ant-select-item-option', { hasText: 'Español' }).click()
  // Español добавился к русскому: лента спрашивает о нём.
  await expect.poll(() => langs.includes('es')).toBe(true)
  await expect(page.getByText('Сначала лучшее')).toBeVisible()
})
