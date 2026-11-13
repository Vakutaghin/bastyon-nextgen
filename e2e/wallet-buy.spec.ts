import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Кошелёк, вкладка «Покупка/продажа»: ссылка под балансами ведёт на неё,
 * курс с (подменного) CoinGecko считает калькулятор, свой адрес с QR, биржи,
 * PKOIN Exchange и объявления #pkoin_commerce. Вкладка — в адресе: ссылка
 * «История переводов» с открытой вкладки переключает её.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const DATA: MockNodeData = { profiles: [], posts: [], comments: [] }

/** Ответ market_chart: 30 дней, последняя цена — 0.139. */
function marketChart() {
  const now = Date.now()
  const prices = Array.from({ length: 31 }, (_, i) => [
    now - (30 - i) * 86_400_000,
    i === 30 ? 0.139 : 0.12 + i * 0.0005,
  ])
  return { prices, market_caps: [], total_volumes: [] }
}

async function signIn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

/** Переход без перезагрузки: сессия живёт в памяти страницы. */
async function goTo(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    const el = document.querySelector('#app') as unknown as {
      __vue_app__: {
        config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
      }
    }
    return el.__vue_app__.config.globalProperties.$router.push(to)
  }, path)
}

async function openWallet(page: Page): Promise<void> {
  await useMockNode(page, DATA)
  await page.route(/api\.coingecko\.com\/api\/v3\/coins\/pocketcoin\/market_chart/, (route) =>
    route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: marketChart() })
  )
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await signIn(page)
  await goTo(page, '/wallets')
}

test('вкладка «Покупка/продажа»: курс, калькулятор, адрес, биржи, продавцы', async ({ page }) => {
  test.setTimeout(90_000)
  await openWallet(page)

  await page.getByTestId('wallet-buy-link').click()
  await expect(page).toHaveURL(/\/wallets\?tab=buy$/)
  await expect(page.getByRole('button', { name: 'Покупка/продажа' })).toHaveClass(/active/)

  const calc = page.getByTestId('buy-calc')
  await expect(calc).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('buy-calc-pkoin')).toHaveValue('100')
  await expect(page.getByTestId('buy-calc-usd')).toHaveValue('13.9')
  await page.getByTestId('buy-calc-usd').fill('27.8')
  await expect(page.getByTestId('buy-calc-pkoin')).toHaveValue('200')

  const address = page.getByTestId('buy-address')
  await expect(address.getByTestId('buy-address-value')).toHaveText(/^P[1-9A-HJ-NP-Za-km-z]{33}$/)
  await expect(address.locator('img')).toBeVisible()

  await expect(page.getByTestId('buy-exchange')).toHaveCount(2)
  await expect(page.getByTestId('buy-exchange').first()).toContainText('PKOIN/USDT')
  await expect(page.getByTestId('buy-risk')).toContainText('сеть не гарантирует')
  await page.getByTestId('buy-exchanges').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/wallet-buy.png', fullPage: true })

  // Ссылка на другую вкладку с открытой — переключает её (вкладка — в адресе).
  await page.getByRole('link', { name: 'История переводов' }).click()
  await expect(page).toHaveURL(/\/wallets\?tab=history$/)
  await expect(page.getByRole('button', { name: 'История', exact: true })).toHaveClass(/active/)

  // Щелчок по вкладке пишет её в адрес — «назад» и ссылки на неё работают.
  await page.getByRole('button', { name: 'Покупка/продажа' }).click()
  await expect(page).toHaveURL(/\/wallets\?tab=buy$/)

  await page.getByTestId('buy-p2p-commerce').click()
  await expect(page).toHaveURL(/\/search\?q=%23pkoin_commerce&type=posts$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/wallets\?tab=buy$/)
  await page.getByTestId('buy-p2p-exchange').click()
  await expect(page).toHaveURL(/\/app\/p2p\.pkoin\.app$/)
})

test('на телефоне вкладка без горизонтальной прокрутки', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 375, height: 800 })
  await openWallet(page)
  await goTo(page, '/wallets?tab=buy')
  await expect(page.getByTestId('buy-calc')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('buy-address')).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: 'test-results/wallet-buy-mobile.png', fullPage: true })
})
