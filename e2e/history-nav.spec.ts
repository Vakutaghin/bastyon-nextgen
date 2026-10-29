import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Стрелки «Назад» и «Вперёд» в шапке на компьютере: листают открытые
 * страницы, как кнопки браузера, и бледнеют, когда листать некуда. Гость на
 * подменной ноде, сеть не нужна.
 */

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [{ txid: 'a'.repeat(64), address: ALICE.address, message: 'Пост для проверки стрелок' }],
}

test.use({ viewport: { width: 1280, height: 800 } })

async function open(page: Page, path: string) {
  await useMockNode(page, DATA)
  await page.goto(path)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

test('стрелки шапки листают открытые страницы', async ({ page }) => {
  await open(page, '/')
  const back = page.getByTestId('history-back')
  const forward = page.getByTestId('history-forward')
  await expect(back).toHaveAttribute('aria-disabled', 'true')
  await expect(forward).toHaveAttribute('aria-disabled', 'true')

  await page.getByRole('button', { name: 'Блокчейн-обозреватель', exact: true }).first().click()
  await expect(page).toHaveURL(/\/explorer/)
  await expect(back).toHaveAttribute('aria-disabled', 'false')

  await back.click()
  await expect(page).toHaveURL(/\/$/)
  await expect(back).toHaveAttribute('aria-disabled', 'true')
  await expect(forward).toHaveAttribute('aria-disabled', 'false')

  await forward.click()
  await expect(page).toHaveURL(/\/explorer/)
  await expect(forward).toHaveAttribute('aria-disabled', 'true')
})
