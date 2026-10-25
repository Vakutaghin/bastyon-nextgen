import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Уведомления: у большинства событий нода присылает только адрес
 * отправителя. Пока его профиль грузится, в карточке скелетоны имени и
 * аватара, потом — ник, а не начало адреса.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const POST = 'a'.repeat(64)
const COMMENT = 'c'.repeat(64)
const HEIGHT = 4_037_000

const DATA: MockNodeData = {
  profiles: [
    { address: ME, name: 'me_ng' },
    { address: ALICE, name: 'alice_ng' },
  ],
  posts: [{ txid: POST, address: ME, message: 'Мой пост', ago: 600 }],
  comments: [],
}

async function signIn(page: Page): Promise<{ answerProfile: () => void }> {
  await useMockNode(page, DATA)
  // Комментарий Алисы: в событии только её адрес, без имени.
  await page.route(/\.pocketnet\.app:8899\/.*getmissedinfo/, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        result: 'success',
        data: [
          { block: HEIGHT, contentsLang: {} },
          {
            mesType: 'comment',
            txid: COMMENT,
            time: Math.floor(Date.now() / 1000) - 60,
            nblock: HEIGHT - 1,
            posttxid: POST,
            addrFrom: ALICE,
            comment: { id: COMMENT, postid: POST, msg: JSON.stringify({ message: 'Отлично!' }) },
          },
        ],
      },
    })
  )
  // Профиль Алисы отвечает, только когда тест разрешит.
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  await page.route(/\.pocketnet\.app:8899\/.*getuserprofile/, async (route) => {
    const body = route.request().postData() ?? ''
    if (body.includes(ALICE)) await gate
    await route.fallback()
  })

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
  return { answerProfile: release }
}

test('ник отправителя вместо адреса, пока грузится — скелетоны', async ({ page }) => {
  const { answerProfile } = await signIn(page)

  await page.getByRole('banner').getByRole('button', { name: 'Уведомления' }).click()
  const menu = page.locator('.header-notifications-dropdown')
  await expect(menu.getByText('Отлично!')).toBeVisible({ timeout: 30_000 })
  await expect(menu.getByTestId('actor-name-skeleton')).toBeVisible()
  await expect(menu.getByTestId('actor-avatar-skeleton')).toBeVisible()
  await expect(menu.getByText(ALICE.slice(0, 8))).toHaveCount(0)

  answerProfile()
  await expect(menu.getByText('alice_ng')).toBeVisible({ timeout: 15_000 })
  await expect(menu.getByTestId('actor-name-skeleton')).toHaveCount(0)
  await expect(menu.getByText(ALICE.slice(0, 8))).toHaveCount(0)
})
