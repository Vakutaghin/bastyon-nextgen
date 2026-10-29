import { test, expect } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «Сменить аккаунт» → «Добавить аккаунт» → «Зарегистрироваться» открывает
 * регистрацию. Раньше окно входа внутри списка аккаунтов просто закрывалось, и
 * человек снова видел список.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'

const DATA: MockNodeData = {
  profiles: [{ address: ME, name: 'me_ng' }],
  posts: [],
  comments: [],
}

test('регистрация второго аккаунта из списка аккаунтов', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const signIn = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await signIn.locator('input, textarea').first().fill(MNEMONIC)
  await signIn.getByRole('button', { name: 'Войти' }).click()
  await expect(signIn).toBeHidden({ timeout: 30_000 })

  await page.locator('[data-header-avatar]').click()
  await page
    .locator('.header-user-dropdown')
    .getByRole('menuitem', { name: 'Сменить аккаунт' })
    .click()
  const accounts = page.getByRole('dialog', { name: 'Сменить аккаунт' })
  await accounts.getByRole('button', { name: '+ Добавить аккаунт' }).click()

  await expect(signIn).toBeVisible()
  await signIn.getByText('Зарегистрироваться', { exact: true }).click()

  const register = page.getByRole('dialog', { name: 'Регистрация' })
  await expect(register).toBeVisible()
  await expect(register.getByLabel('Псевдоним')).toBeEditable()
  await expect(accounts).toBeHidden()
  await expect(signIn).toBeHidden()
})
