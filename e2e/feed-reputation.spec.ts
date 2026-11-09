import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { useMockNode } from './support/mock-node'

/**
 * «Репутация авторов» под «Языком ленты»: посты авторов с репутацией ниже
 * порога в ленте не показываются; готовый порог, свой и «Любая»; порог
 * помнится после перезапуска. Нода подменная.
 */

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PBobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

/** «Что нового» этой версии уже видели (use-changelog.ts): окно не встанет поверх ленты. */
const APP_VERSION = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
  .version

test('порог репутации прячет посты новичков; свой порог и «Любая»', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await useMockNode(page, {
    profiles: [
      { address: ALICE, name: 'alice_ng', reputation: 5000 },
      { address: BOB, name: 'bob_ng', reputation: 3 },
    ],
    posts: [
      { txid: 'a'.repeat(64), address: ALICE, message: 'Пишет Алиса', ago: 60 },
      { txid: 'b'.repeat(64), address: BOB, message: 'Пишет новичок Боб', ago: 120 },
    ],
    comments: [],
  })
  await page.addInitScript((version) => {
    if (!localStorage.getItem('bastyon_locale')) localStorage.setItem('bastyon_locale', 'ru')
    localStorage.setItem('bastyonChangelogLastSeenVersion', version)
  }, APP_VERSION)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  const feed = page.locator('main')
  await expect(feed.getByText('Пишет новичок Боб')).toBeVisible({ timeout: 30_000 })

  const field = page.locator('.ant-select', { has: page.getByLabel('Репутация авторов') })
  await field.click()
  await page.locator('.ant-select-item-option', { hasText: 'От 100' }).first().click()
  await expect(feed.getByText('Пишет новичок Боб')).toHaveCount(0, { timeout: 30_000 })
  await expect(feed.getByText('Пишет Алиса')).toBeVisible()

  // После перезапуска порог тот же.
  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await expect(feed.getByText('Пишет Алиса')).toBeVisible({ timeout: 30_000 })
  await expect(feed.getByText('Пишет новичок Боб')).toHaveCount(0)
  await expect(page.getByTestId('feed-min-reputation')).toContainText('От 100')

  // Свой порог: 2 — Боб снова виден; в поле выбора — «От 2».
  await field.click()
  await page.locator('.ant-select-item-option', { hasText: 'Своя…' }).click()
  const own = page.getByTestId('feed-min-reputation-value')
  await expect(own).toBeFocused()
  await own.fill('2')
  await own.press('Enter')
  await expect(feed.getByText('Пишет новичок Боб')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('feed-min-reputation')).toContainText('От 2')

  // «Любая» — поле своего порога пропадает.
  await field.click()
  await page.locator('.ant-select-item-option', { hasText: 'Любая' }).click()
  await expect(own).toHaveCount(0)
  await expect(feed.getByText('Пишет новичок Боб')).toBeVisible()
})
