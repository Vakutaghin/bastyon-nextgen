import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Профиль: закреплённый пост (поле `pin` настроек аккаунта) стоит первым с
 * меткой «Закреплено» — даже если до него лента ещё не дошла, — и второй раз
 * в ленте не встречается. Поиск по постам автора ищет только у него (RPC
 * `search` с адресом), слова держатся в адресе, крестик возвращает ленту.
 * У своего поста в меню — «Закрепить в профиле» или «Открепить».
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'

const tx = (c: string) => c.repeat(64)
const PINNED = tx('a')
const MY_PINNED = tx('e')
const MY_OTHER = tx('f')

const DATA: MockNodeData = {
  profiles: [
    { address: ME, name: 'me_ng' },
    { address: ALICE, name: 'alice_ng' },
    { address: BOB, name: 'bob_ng' },
  ],
  posts: [
    { txid: tx('b'), address: ALICE, message: 'Свежий пост про горы Алтая', ago: 60 },
    { txid: tx('c'), address: ALICE, message: 'Пост про велосипед', ago: 120 },
    { txid: tx('d'), address: BOB, message: 'Боб тоже любит горы', ago: 180 },
    // Старый пост: в общих лентах его нет, лента профиля до него ещё не дошла.
    { txid: PINNED, address: ALICE, message: 'Закреплённое приветствие', byIdOnly: true },
    { txid: MY_PINNED, address: ME, message: 'Мой закреплённый пост', ago: 300 },
    { txid: MY_OTHER, address: ME, message: 'Мой обычный пост', ago: 240 },
  ],
  comments: [],
  settings: {
    [ALICE]: { pin: PINNED, monetization: '', paidsubscription: 0, cover: '' },
    [ME]: { pin: MY_PINNED, monetization: '', paidsubscription: 0, cover: '' },
  },
}

test.use({ viewport: { width: 1366, height: 900 } })

async function open(page: Page, path: string): Promise<void> {
  await useMockNode(page, DATA)
  await page.goto(path)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

test('закреплённый пост — первым, с меткой, и в ленте один раз', async ({ page }) => {
  // Лента профиля отдаёт по одной странице: закреплённый старый пост в неё не попал.
  await open(page, `/${ALICE}`)
  const first = page.locator('.post-card').first()
  await expect(first).toContainText('Закреплённое приветствие', { timeout: 30_000 })
  await expect(first.getByTestId('post-pinned')).toHaveText('Закреплено')
  await expect(page.locator('.post-card').nth(1)).toContainText('Свежий пост про горы')
  await expect(page.locator('.post-card', { hasText: 'Закреплённое приветствие' })).toHaveCount(1)
  await expect(page.getByTestId('post-pinned')).toHaveCount(1)
})

test('поиск по постам автора: только его посты, слова в адресе, крестик — снова лента', async ({
  page,
}) => {
  await open(page, `/${ALICE}`)
  await expect(page.locator('.post-card').first()).toContainText('Закреплённое', {
    timeout: 30_000,
  })

  const field = page.getByTestId('profile-search')
  await field.fill('горы')
  await field.press('Enter')
  await expect(page).toHaveURL(/\?q=%D0%B3%D0%BE%D1%80%D1%8B$/)

  const results = page.getByTestId('profile-search-results')
  await expect(results.locator('.post-card')).toHaveCount(1)
  await expect(results).toContainText('Свежий пост про горы Алтая')
  await expect(results).not.toContainText('Боб тоже любит горы')
  await expect(results).toContainText('Больше ничего не нашлось')

  await field.fill('самокат')
  await field.press('Enter')
  await expect(results).toContainText('Ничего не нашлось')
  await expect(results.locator('.post-card')).toHaveCount(0)

  // Крестик в поле — поиск сброшен, лента с закреплённым на месте.
  await page.getByTestId('profile-search-bar').locator('.ant-input-clear-icon').click()
  await expect(page).not.toHaveURL(/\?q=/)
  await expect(results).toBeHidden()
  await expect(page.locator('.post-card').first()).toContainText('Закреплённое приветствие')
})

test('поиск открывается по адресу со словами', async ({ page }) => {
  await open(page, `/${ALICE}?q=${encodeURIComponent('велосипед')}`)
  const results = page.getByTestId('profile-search-results')
  await expect(results.locator('.post-card')).toHaveCount(1, { timeout: 30_000 })
  await expect(results).toContainText('Пост про велосипед')
  await expect(page.getByTestId('profile-search')).toHaveValue('велосипед')
})

test('свой пост: в меню «Закрепить в профиле», у закреплённого — «Открепить»', async ({ page }) => {
  await open(page, '/')
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })

  await page.evaluate(
    (p) =>
      (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $router: { push(p: string): void } } } }
        }
      ).__vue_app__.config.globalProperties.$router.push(p),
    `/${ME}`
  )
  const pinnedCard = page.locator('.post-card').first()
  await expect(pinnedCard).toContainText('Мой закреплённый пост', { timeout: 30_000 })
  await expect(pinnedCard.getByTestId('post-pinned')).toBeVisible()

  const pinItem = page.getByTestId('post-pin').filter({ visible: true })
  await pinnedCard.getByRole('button', { name: 'Поделиться' }).click()
  await expect(pinItem).toHaveText('Открепить')
  await pinnedCard.getByRole('button', { name: 'Поделиться' }).click()
  await expect(pinItem).toHaveCount(0)

  const other = page.locator('.post-card', { hasText: 'Мой обычный пост' })
  await other.getByRole('button', { name: 'Поделиться' }).click()
  await expect(pinItem).toHaveText('Закрепить в профиле')
  await other.getByRole('button', { name: 'Поделиться' }).click()

  // У чужого поста пункта нет.
  await page.evaluate(
    (p) =>
      (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $router: { push(p: string): void } } } }
        }
      ).__vue_app__.config.globalProperties.$router.push(p),
    `/${ALICE}`
  )
  const alicePost = page.locator('.post-card', { hasText: 'Пост про велосипед' })
  await alicePost.getByRole('button', { name: 'Поделиться' }).click()
  await expect(
    page.getByRole('button', { name: 'Скопировать ссылку' }).filter({ visible: true })
  ).toBeVisible()
  await expect(pinItem).toHaveCount(0)
})
