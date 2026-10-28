import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData, type MockPost } from './support/mock-node'
import { useMockPeerTube, VIDEO_URL } from './support/mock-peertube'

/**
 * Главная лента, как в старом клиенте: просмотры под видеопостом, продвигаемые
 * посты на своих местах (после 5-го, 14-го и 28-го), наверху — новое от
 * подписок с плашкой «Продолжить в ленте подписок»; гостю «Начать чат»
 * открывает вход; жалоба — только «акуле», остальным окно сразу говорит
 * почему. Нода и PeerTube подменные, в сеть ничего не уходит.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PBobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const PKOIN = 100_000_000

const txid = (prefix: string, n: number) => `${prefix}${String(n).padStart(4, '0')}`.padEnd(64, '0')

function makeData(opts: { shark?: boolean } = {}): MockNodeData {
  const regular: MockPost[] = Array.from({ length: 30 }, (_, i) => ({
    txid: txid('b', i),
    address: BOB,
    message: `Пост Боба ${i + 1}`,
    ago: 1000 + i * 60,
  }))
  regular[1] = { ...regular[1]!, type: 'video', url: VIDEO_URL, message: 'Ролик Боба' }
  const boosted: MockPost[] = [1, 2, 3].map((n) => ({
    txid: txid('f', n),
    address: BOB,
    message: `Продвигаемый ${n}`,
    byIdOnly: true,
  }))
  return {
    profiles: [
      { address: ME, name: 'me_ng', badges: opts.shark ? ['shark'] : [] },
      { address: ALICE, name: 'alice_ng' },
      { address: BOB, name: 'bob_ng' },
    ],
    posts: [
      { txid: txid('a', 1), address: ALICE, message: 'Свежее от Алисы', ago: 60 },
      { txid: txid('a', 2), address: ALICE, message: 'Ещё от Алисы', ago: 120 },
      ...regular,
      ...boosted,
    ],
    comments: [],
    subscribes: [ALICE],
    boosts: boosted.map((p, i) => ({ txid: p.txid, boost: (i + 1) * 10 * PKOIN })),
  }
}

async function open(page: Page, data: MockNodeData): Promise<void> {
  await useMockNode(page, data)
  await page.route('**/_matrix/**', (route) => route.abort())
  await page.goto('/')
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

const cards = (page: Page) => page.locator('article.post-card, .post-card')

/** Номера карточек с меткой «Продвигаемое». */
const boostedAt = (page: Page) =>
  cards(page).evaluateAll((els) =>
    els.flatMap((el, i) => (el.textContent?.includes('Продвигаемое') ? [i] : []))
  )

test('гость: просмотры под роликом, бусты на местах старого клиента, чат — через вход', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await useMockPeerTube(page, { views: 1234 })
  await open(page, makeData())

  // 2 поста Алисы + 30 Боба и 3 продвигаемых: гостю подборки подписок нет.
  await expect(cards(page)).toHaveCount(35, { timeout: 30_000 })
  expect(await boostedAt(page)).toEqual([5, 15, 30])

  const views = page.getByTestId('post-views')
  await expect(views).toHaveCount(1)
  await expect(views).toHaveAttribute('aria-label', /^1\s234 просмотра$/)
  await expect(views).toContainText(/1,2\sтыс\./)

  await cards(page).first().getByRole('button', { name: 'Начать чат' }).click()
  await expect(page.getByRole('dialog', { name: 'Вход в аккаунт' })).toBeVisible()
})

test('вошедший: сначала новое от подписок, плашка, общая лента без повторов', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await open(page, makeData())
  await signIn(page)

  const divider = page.getByTestId('feed-subscriptions-divider')
  await expect(divider).toBeVisible({ timeout: 30_000 })
  await expect(divider).toContainText('Выше — новое от тех, на кого вы подписаны')
  await expect(cards(page).nth(0)).toContainText('Свежее от Алисы')
  await expect(cards(page).nth(1)).toContainText('Ещё от Алисы')
  // Посты Алисы не повторяются ниже, в общей ленте.
  await expect(cards(page).filter({ hasText: 'Алисы' })).toHaveCount(2)
  // Места бустов считаются по общей ленте, под плашкой.
  await expect(cards(page)).toHaveCount(35, { timeout: 30_000 })
  expect(await boostedAt(page)).toEqual([7, 17, 32])

  // Плашку пролистали до экрана — подборка просмотрена, после перезагрузки её нет.
  expect(await page.evaluate(() => localStorage.getItem('bastyon_subscriptions_seen'))).toBeNull()
  await divider.scrollIntoViewIfNeeded()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('bastyon_subscriptions_seen')))
    .toContain(ME)

  await divider.getByRole('button', { name: 'Продолжить в ленте «Подписки»' }).click()
  await expect(page).toHaveURL(/feedMode=subscriptions/)
  await expect(divider).toHaveCount(0)

  await page.goto('/')
  // Вход восстановился — в шапке имя аккаунта.
  await expect(page.locator('header').getByText('me_ng')).toBeVisible({ timeout: 30_000 })
  await expect(cards(page).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('feed-subscriptions-divider')).toHaveCount(0)
})

test('жалоба: не «акуле» окно сразу объясняет и предлагает блокировку', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await open(page, makeData())
  await signIn(page)

  const bobPost = cards(page).filter({ hasText: 'Пост Боба 1' }).first()
  await bobPost.getByRole('button', { name: 'Поделиться' }).click()
  await page.getByRole('button', { name: 'Пожаловаться' }).filter({ visible: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Жалоба на пост' })
  await expect(dialog.getByTestId('report-shark-only')).toContainText('«Акула»')
  await expect(dialog.getByRole('button', { name: 'Спам' })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Заблокировать автора' }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.locator('.ant-modal-confirm').filter({ hasText: 'Заблокировать' })
  ).toBeVisible()
})

test('жалоба: «акуле» — причины и отправка', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await open(page, makeData({ shark: true }))
  await signIn(page)

  const bobPost = cards(page).filter({ hasText: 'Пост Боба 1' }).first()
  await bobPost.getByRole('button', { name: 'Поделиться' }).click()
  await page.getByRole('button', { name: 'Пожаловаться' }).filter({ visible: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Жалоба на пост' })
  await expect(dialog.getByTestId('report-shark-only')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Спам' }).click()
  await expect(dialog.getByRole('button', { name: 'Отправить жалобу' })).toBeEnabled()
})
