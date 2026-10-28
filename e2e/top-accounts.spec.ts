import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData, type MockProfile } from './support/mock-node'

/**
 * «Топ аккаунтов»: самые репутационные подписчики самых подписываемых
 * аккаунтов сети и сами они, по репутации; строки — по 30, при прокрутке ещё;
 * строка ведёт в профиль. Нода подменная.
 */

// Те же «узлы», что в src/services/top-accounts.ts (TOP_HUBS).
const HUBS = [
  'PHdW4pwWbFdoofVhSEfPSHgradmrvZdbE5',
  'PSBePd5Tx5KG9vxwAzbaDTfjzDbq1GUTYw',
  'PMABcFZc7fcgPZzstJrHeYoWXJGoP3pd7X',
  'PLfHpn9nJe9hKJ7UqvAuPsPUu9RjNpyTrN',
]

const pad = (i: number) => String(i).padStart(2, '0')
/** 40 аккаунтов: у user_01 репутация самая высокая, у user_40 — самая низкая. */
const USERS: MockProfile[] = Array.from({ length: 40 }, (_, i) => ({
  address: `PUser${pad(i + 1)}`.padEnd(34, 'x'),
  name: `user_${pad(i + 1)}`,
  reputation: 5000 - i * 100,
}))

const DATA: MockNodeData = {
  profiles: [
    ...USERS,
    {
      address: HUBS[0]!,
      name: 'founder_ng',
      reputation: 2050,
      subscribers: USERS.map((u) => u.address),
    },
    {
      address: HUBS[1]!,
      name: 'second_hub',
      reputation: 10,
      subscribers: USERS.slice(0, 5).map((u) => u.address),
    },
  ],
  posts: [],
  comments: [],
}

async function openTop(page: Page, path = '/top'): Promise<void> {
  await useMockNode(page, DATA)
  await page.goto(path)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

test('по репутации, подгрузка при прокрутке и переход в профиль', async ({ page }) => {
  test.setTimeout(120_000)
  await openTop(page)
  const list = page.getByTestId('top-accounts')
  const rows = list.getByRole('listitem')
  await expect(rows.first()).toContainText('user_01', { timeout: 30_000 })
  await expect(rows.first()).toContainText('5 000')
  await expect(rows).toHaveCount(30)

  await rows.last().scrollIntoViewIfNeeded()
  await expect(rows).toHaveCount(42)
  // Узел — среди своих подписчиков по репутации: 2050 — между user_30 и user_31.
  await expect(rows.nth(30)).toContainText('founder_ng')
  await expect(rows.last()).toContainText('second_hub')
  await expect(list.getByText('PKOIN')).toHaveCount(0)

  await rows.filter({ hasText: 'user_36' }).click()
  await expect(page).toHaveURL(/\/user_36$/)
})

test('«Топ аккаунтов» в левой панели', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await openTop(page, '/')
  await page.getByRole('button', { name: 'Топ аккаунтов' }).click()
  await expect(page).toHaveURL(/\/top$/)
  await expect(page.getByRole('heading', { name: 'Топ аккаунтов' })).toBeVisible()
})
