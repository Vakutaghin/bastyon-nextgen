import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Кошелёк: вкладки «История» и «Заработок» на подменной ноде. Ответы
 * `getaddresstransactions` той же формы, что у mainnet (22.10.2026): страница
 * внутри отсортирована по txid, порядок — в `rowNumber`. Первая страница —
 * одни свои комментарии без монет: раньше на ней история показывала
 * «Транзакций пока нет», а ещё раньше запрос `[адрес, -1, 30]` всегда
 * возвращал пусто.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const DATA: MockNodeData = { profiles: [], posts: [], comments: [] }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const DONOR = 'PAmockDonor11111111111111111111111'
const STAKER = 'PAmockStaker1111111111111111111111'
const PAYER = 'PAmockPayer11111111111111111111111'
const TOP = 4_072_000
const PAGE = 30

interface Out {
  address: string
  value: number
  hex?: string
}

const opReturn = (text: string): Out => {
  const data = Buffer.from(text, 'utf8').toString('hex')
  return {
    address: '',
    value: 0,
    hex: `6a${(data.length / 2).toString(16).padStart(2, '0')}${data}`,
  }
}

function tx(
  txid: string,
  type: number,
  height: number,
  vin: { address: string; value: number }[],
  vout: Out[]
) {
  return {
    txid,
    type,
    height,
    blockHash: 'b'.repeat(64),
    nTime: 1_792_000_000 + height,
    vin: vin.map((i, n) => ({ txid: 'c'.repeat(64), vout: n, ...i })),
    vout: vout.map((o, n) => ({
      n,
      value: o.value,
      scriptPubKey: { addresses: [o.address], hex: o.hex ?? '' },
    })),
  }
}

/** Как отдаёт нода: rowNumber — порядок по высоте, сам список — по txid. */
function asNode(txs: ReturnType<typeof tx>[]) {
  return txs
    .map((t, rowNumber) => ({ ...t, rowNumber }))
    .sort((a, b) => a.txid.localeCompare(b.txid))
}

function pages(me: string) {
  const comments = Array.from({ length: PAGE }, (_, i) =>
    tx(
      (i * 7919).toString(16).padStart(64, '0'),
      204,
      TOP - i,
      [{ address: me, value: 1 }],
      [opReturn('comment'), { address: me, value: 1 }]
    )
  )
  const money = [
    tx(
      'd1'.repeat(32),
      204,
      TOP - 100,
      [{ address: DONOR, value: 1.1 }],
      [opReturn('comment'), { address: me, value: 1 }, { address: DONOR, value: 0.1 }]
    ),
    tx(
      'a2'.repeat(32),
      208,
      TOP - 110,
      [{ address: me, value: 7 }],
      [opReturn('contentBoost'), { address: me, value: 4.5 }]
    ),
    tx(
      'f3'.repeat(32),
      3,
      TOP - 120,
      [{ address: STAKER, value: 60 }],
      [
        { address: '', value: 0 },
        { address: STAKER, value: 59.97 },
        { address: me, value: 0.03125 },
      ]
    ),
    tx(
      '04'.repeat(32),
      1,
      TOP - 130,
      [{ address: PAYER, value: 100 }],
      [opReturn('a:monetization'), { address: me, value: 0.53 }, { address: PAYER, value: 99.4 }]
    ),
    tx(
      'e5'.repeat(32),
      1,
      TOP - 140,
      [{ address: me, value: 10 }],
      [
        { address: DONOR, value: 3 },
        { address: me, value: 6.99 },
      ]
    ),
  ]
  return { comments: asNode(comments), money: asNode(money) }
}

async function useHistoryNode(page: Page): Promise<unknown[][]> {
  const calls: unknown[][] = []
  const answer = (route: Route, data: unknown) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ headers: CORS, json: { result: 'success', data } })

  await page.route(/\.pocketnet\.app:8899\/rpc(-ex)?\/getaddresstransactions/, (route) => {
    if (route.request().method() === 'OPTIONS') return answer(route, null)
    const params = route.request().postDataJSON().parameters as unknown[]
    calls.push(params)
    const { comments, money } = pages(params[0] as string)
    const skip = params[2] as number
    return answer(route, skip === 0 ? comments : skip === PAGE ? money : [])
  })
  await page.route(/\.pocketnet\.app:8899\/rpc(-ex)?\/getaccountearning/, (route) => {
    if (route.request().method() === 'OPTIONS') return answer(route, null)
    const [address] = route.request().postDataJSON().parameters as [string]
    // Суммы аккаунта с mainnet, в сатоши.
    return answer(route, [
      {
        address,
        amountLottery: 114_583_334,
        amountDonation: 56_023_000_000,
        amountTransfer: 17_661_234_996,
      },
    ])
  })
  return calls
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

test('история кошелька: движения монет, метки, порядок и страницы ноды', async ({ page }) => {
  test.setTimeout(90_000)
  await useMockNode(page, DATA)
  const calls = await useHistoryNode(page)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await signIn(page)
  await goTo(page, '/wallets')

  await page.getByRole('button', { name: 'История', exact: true }).click()
  const rows = page.locator('a[href*="/explorer/tx/"]')
  await expect(rows).toHaveCount(5, { timeout: 20_000 })
  await expect(page.getByText('Транзакций пока нет')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Загрузить ещё' })).toHaveCount(0)

  // От новых к старым, с метками и суммами.
  await expect(rows.nth(0)).toContainText('Получено')
  await expect(rows.nth(0)).toContainText('С комментарием')
  await expect(rows.nth(0)).toContainText('+1 PKOIN')
  await expect(rows.nth(1)).toContainText('Отправлено')
  await expect(rows.nth(1)).toContainText('Буст')
  await expect(rows.nth(1)).toContainText('−2.5 PKOIN')
  await expect(rows.nth(2)).toContainText('Лотерея')
  await expect(rows.nth(2)).toContainText('+0.0313 PKOIN')
  await expect(rows.nth(3)).toContainText('Монетизация')
  await expect(rows.nth(3)).toContainText('+0.53 PKOIN')
  await expect(rows.nth(4)).toContainText('Отправлено')
  await expect(rows.nth(4)).toContainText('−3 PKOIN')

  // Запросы — в формате ноды: верхний блок, сколько пропустить, размер,
  // направление, типы с движением монет. Вторая страница — под верхним блоком
  // первой, сама, без «Загрузить ещё».
  const me = calls[0]![0]
  expect(calls).toEqual([
    [me, 999_999_999, 0, PAGE, 0, [1, 2, 3, 204, 208]],
    [me, TOP, PAGE, PAGE, 0, [1, 2, 3, 204, 208]],
  ])

  await page.getByRole('button', { name: 'Заработок', exact: true }).click()
  await expect(page.getByText('Заработок аккаунта')).toBeVisible()
  await expect(page.getByText('1.14583334')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('560.23')).toBeVisible()
  await expect(page.getByText('176.61234996')).toBeVisible()
})
