import { test, expect } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Адрес или публичный ключ в строке поиска находит аккаунт: поиск по имени
 * (`searchusers`) на адрес пуст, поэтому профиль берётся по адресу. Ключ и
 * адрес — из тестовых векторов одной мнемоники. Нода подменная.
 */

const ADDRESS = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const PUBLIC_KEY = '03538bedd425db67b3f68b1152235b56e4d938284dc31bb72648c2079b00f6101f'
const DATA: MockNodeData = {
  profiles: [{ address: ADDRESS, name: 'alice_ng' }],
  posts: [],
  comments: [],
}

test('адрес и публичный ключ в поиске показывают аккаунт', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.route('**/_matrix/**', (route) => route.abort())
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})

  const input = page.getByPlaceholder('Поиск...')
  const account = page.getByRole('button', { name: /alice_ng/ })

  for (const query of [ADDRESS, PUBLIC_KEY]) {
    await input.fill('')
    await expect(account).toHaveCount(0)
    await input.fill(query)
    await expect(page.getByText('Пользователи')).toBeVisible({ timeout: 15_000 })
    await expect(account).toBeVisible()
  }

  // Из выдачи — в профиль.
  await account.click()
  await expect(page).toHaveURL(new RegExp(ADDRESS))
})
