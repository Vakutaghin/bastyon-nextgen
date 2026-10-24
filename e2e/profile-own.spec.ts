import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Свой профиль и свои посты: написать себе и оформить платную подписку на
 * себя нельзя — кнопок нет. Обложка — только своя у автора: без неё полосы
 * вверху нет. У чужого профиля всё на месте.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
// Адрес тест-мнемоника: профиль должен быть у ноды до входа, иначе своя
// страница — «Регистрация в процессе».
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const COVER = 'https://cover.example.org/alice.jpg'

async function signIn(page: Page, data: MockNodeData): Promise<void> {
  await useMockNode(page, data)
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

function makeData(): MockNodeData {
  return {
    profiles: [
      { address: ALICE, name: 'alice_ng' },
      { address: ME, name: 'me_ng' },
    ],
    posts: [
      { txid: 'a'.repeat(64), address: ALICE, message: 'Пост Алисы', ago: 600 },
      { txid: 'b'.repeat(64), address: ME, message: 'Мой пост', ago: 300 },
    ],
    comments: [],
    // Цена есть у обоих: на своём профиле кнопки нет не из-за её отсутствия.
    settings: { [ALICE]: { cover: COVER, paidsubscription: 10 }, [ME]: { paidsubscription: 5 } },
  }
}

test.beforeEach(async ({ page }) => {
  // Обложка Алисы — настоящая картинка: иначе она не загрузится и полосы не будет.
  await page.route(COVER, (route) =>
    route.fulfill({ path: 'e2e/fixtures/test-video.jpg', contentType: 'image/jpeg' })
  )
})

test('свой профиль — без «Начать чат», платной подписки и пустой обложки', async ({ page }) => {
  const data = makeData()
  await signIn(page, data)

  await page.goto(`/${ME}`)
  await expect(page.getByRole('button', { name: 'Редактировать профиль' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator('.post-card').filter({ hasText: 'Мой пост' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('button', { name: 'Начать чат' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Платная подписка/ })).toHaveCount(0)
  await expect(page.getByTestId('profile-cover')).toHaveCount(0)
})

test('чужой профиль — обложка, чат и платная подписка на месте', async ({ page }) => {
  const data = makeData()
  await signIn(page, data)

  await page.goto(`/${ALICE}`)
  await expect(page.getByTestId('profile-cover')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('profile-cover').locator('img')).toHaveAttribute('src', COVER)
  await expect(page.getByRole('button', { name: 'Начать чат' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Платная подписка/ })).toBeVisible()
})

test('чужой профиль без обложки — без полосы', async ({ page }) => {
  const data = makeData()
  delete data.settings![ALICE]!.cover
  await signIn(page, data)

  await page.goto(`/${ALICE}`)
  await expect(page.getByRole('button', { name: /Платная подписка/ })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByTestId('profile-cover')).toHaveCount(0)
})

test('в ленте кнопка чата — только у чужих постов', async ({ page }) => {
  const data = makeData()
  await signIn(page, data)

  await page.goto(`/${ME}`)
  const mine = page.locator('.post-card').filter({ hasText: 'Мой пост' }).first()
  await expect(mine).toBeVisible({ timeout: 30_000 })
  await expect(mine.getByRole('button', { name: 'Начать чат' })).toHaveCount(0)

  await page.goto(`/${ALICE}`)
  const hers = page.locator('.post-card').filter({ hasText: 'Пост Алисы' }).first()
  await expect(hers).toBeVisible({ timeout: 30_000 })
  await expect(hers.getByRole('button', { name: 'Начать чат' })).toBeVisible()
})
