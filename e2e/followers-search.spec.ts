import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Список подписчиков: порядок «Сначала новые» (по высоте блока подписки) или
 * «По репутации» — из строк самой ноды, без лишних запросов; поиск по нику и
 * по части адреса.
 */

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PBobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const CAROL = 'PCaroooooooooooooooooooooooooooooo'
const DAVE = 'PDaveeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const ERIN = 'PErinnnnnnnnnnnnnnnnnnnnnnnnnnnnnn'

const DATA: MockNodeData = {
  profiles: [
    // Подписались по порядку: Боб первым, Эрин последней.
    { address: ALICE, name: 'alice_ng', subscribers: [BOB, CAROL, DAVE, ERIN] },
    { address: BOB, name: 'bob_ng', reputation: 120 },
    { address: CAROL, name: 'carol_ng', reputation: 5 },
    { address: DAVE, name: 'dave_ng', reputation: 300 },
    { address: ERIN, name: 'erin_ng', reputation: 50 },
  ],
  posts: [],
  comments: [],
}

test.use({ viewport: { width: 1366, height: 900 } })

async function openFollowers(page: Page) {
  await useMockNode(page, DATA)
  await page.goto(`/${ALICE}`)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page
    .getByRole('button', { name: /^Подписчики/ })
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 })
  return page.getByRole('dialog', { name: 'Подписчики' })
}

const names = async (dialog: ReturnType<Page['getByRole']>) =>
  (await dialog.getByTestId('relations-name').allInnerTexts()).map((t) => t.trim())

test('порядок: сначала новые, по репутации', async ({ page }) => {
  const dialog = await openFollowers(page)
  await expect(dialog.getByTestId('relations-row')).toHaveCount(4, { timeout: 20_000 })
  await expect(dialog.getByTestId('relations-sort-new')).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => names(dialog)).toEqual(['erin_ng', 'dave_ng', 'carol_ng', 'bob_ng'])

  await dialog.getByTestId('relations-sort-reputation').click()
  await expect.poll(() => names(dialog)).toEqual(['dave_ng', 'bob_ng', 'erin_ng', 'carol_ng'])
  await expect(dialog.getByTestId('relations-row').first()).toContainText('Репутация: 300.0')
})

test('поиск по нику и по части адреса', async ({ page }) => {
  const dialog = await openFollowers(page)
  await expect(dialog.getByTestId('relations-row')).toHaveCount(4, { timeout: 20_000 })
  const field = dialog.getByTestId('relations-search')

  await field.fill('CAR')
  await expect(dialog.getByTestId('relations-row')).toHaveCount(1)
  await expect(dialog.getByTestId('relations-row')).toContainText('carol_ng')
  await expect(dialog.getByTestId('relations-search-status')).toHaveText('Найден 1')

  await field.fill('@PDaveee')
  await expect(dialog.getByTestId('relations-row')).toHaveCount(1)
  await expect(dialog.getByTestId('relations-row')).toContainText('dave_ng')

  await field.fill('_ng')
  await expect(dialog.getByTestId('relations-row')).toHaveCount(4)
  await expect(dialog.getByTestId('relations-search-status')).toHaveText('Найдено 4')

  await field.fill('самокат')
  await expect(dialog).toContainText('Никого не нашлось')

  await field.fill('')
  await expect(dialog.getByTestId('relations-row')).toHaveCount(4)
})
