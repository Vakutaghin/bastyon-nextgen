import { test, expect } from '@playwright/test'
import { useMockNode, type MockApp } from './support/mock-node'

/**
 * Каталог «Сервисов» догружается при прокрутке: кнопку «Загрузить ещё» внизу
 * длинной страницы не видели, и приложения дальше первых двадцати оставались
 * ненайденными. Нода подменная: 120 приложений, страницы по 20 — больше, чем
 * догружается заранее, без прокрутки.
 */

const APPS: MockApp[] = Array.from({ length: 120 }, (_, i) => ({
  id: `catalog${String(i + 1).padStart(3, '0')}.app`,
  name: `Catalog App ${String(i + 1).padStart(3, '0')}`,
  scope: `catalog${i + 1}.example`,
  description: `App number ${i + 1}`,
}))

test('каталог догружается прокруткой, без «Загрузить ещё»', async ({ page }) => {
  test.setTimeout(120_000)
  await useMockNode(page, { profiles: [], posts: [], comments: [], apps: APPS })
  await page.goto('/miniapps')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})

  const cards = page.getByRole('button').filter({ hasText: /Catalog App \d+/ })
  await expect(cards.first()).toBeVisible({ timeout: 30_000 })

  // Листаем к последней карточке, пока не догрузятся все: каждая страница — сама.
  await expect(async () => {
    await cards.last().scrollIntoViewIfNeeded()
    await expect(cards).toHaveCount(APPS.length, { timeout: 1_000 })
  }).toPass({ timeout: 30_000 })

  await expect(cards.last()).toContainText('Catalog App 120')
  await expect(page.getByRole('button', { name: 'Загрузить ещё' })).toHaveCount(0)
  await expect(page.getByTestId('miniapps-load-more-sentinel')).toHaveCount(0)
})
