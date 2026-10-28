import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData, type MockProfile } from './support/mock-node'

/**
 * «Топ аккаунтов»: самые репутационные подписчики самых подписываемых
 * аккаунтов сети и сами они, по репутации; строки — по 30, при прокрутке ещё;
 * строка ведёт в профиль; поиск по топу; подписка из строки. Нода подменная,
 * транзакции перехватываются и в сеть не уходят.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

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

async function openTop(page: Page, path = '/top', data: MockNodeData = DATA): Promise<void> {
  await useMockNode(page, data)
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

test('поиск по топу: по имени и адресу, место из полного топа', async ({ page }) => {
  test.setTimeout(120_000)
  await openTop(page)
  const rows = page.getByTestId('top-accounts').getByRole('listitem')
  await expect(rows.first()).toContainText('user_01', { timeout: 30_000 })

  const filter = page.getByRole('textbox', { name: 'Найти в топе по имени или адресу' })
  // user_36 — за первыми 30 строками: имя догружается ради поиска.
  await filter.fill('@USER_36')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('user_36')
  await expect(rows.first()).toContainText('37')

  await filter.fill('PUser05')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('user_05')

  await filter.fill('нет такого')
  await expect(page.getByText('В топе нет аккаунта с таким именем или адресом.')).toBeVisible()

  await filter.fill('')
  await expect(rows).toHaveCount(30)
})

test('подписка из строки топа: подписаться сразу, отписка — с вопросом', async ({ page }) => {
  test.setTimeout(120_000)
  const sent: unknown[][] = []
  await page.route(/\.pocketnet\.app:8899\/rpc(-ex)?\/txunspent/, (route) =>
    answer(route, (address) => [
      {
        txid: 'c'.repeat(64),
        vout: 0,
        address,
        amount: 1,
        amountSat: 100_000_000,
        confirmations: 120,
        scriptPubKey: p2pkh(address),
      },
    ])
  )
  await page.route(/\.pocketnet\.app:8899\/rpc(-ex)?\/sendrawtransactionwithmessage/, (route) => {
    if (route.request().method() !== 'OPTIONS')
      sent.push(route.request().postDataJSON().parameters as unknown[])
    return answer(route, () => 'f'.repeat(64))
  })
  await openTop(page, '/top', { ...DATA, subscribes: [USERS[1]!.address] })

  const rows = page.getByTestId('top-accounts').getByRole('listitem')
  await expect(rows.first()).toContainText('user_01', { timeout: 30_000 })
  // Гость кнопок не видит.
  await expect(page.getByTestId('top-follow')).toHaveCount(0)

  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })

  const first = rows.first().getByTestId('top-follow')
  const second = rows.nth(1).getByTestId('top-follow')
  await expect(first).toHaveText('Подписаться')
  await expect(second).toHaveText('Вы подписаны')

  // Кнопка не открывает профиль: она рядом со ссылкой, а не в ней.
  await first.click()
  await expect.poll(() => sent.length).toBe(1)
  expect(JSON.stringify(sent[0])).toContain('subscribe')
  await expect(page).toHaveURL(/\/top$/)
  await expect(first).toHaveText('Вы подписаны', { timeout: 15_000 })

  await second.click()
  const confirm = page.getByRole('dialog').filter({ hasText: 'Отписаться' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Отмена' }).click()
  expect(sent).toHaveLength(1)
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function answer(route: Route, data: (address: string) => unknown): Promise<void> {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
  const params = (route.request().postDataJSON()?.parameters ?? []) as unknown[]
  const first = params[0]
  const address = String(Array.isArray(first) ? first[0] : (first ?? ''))
  return route.fulfill({ headers: CORS, json: { result: 'success', data: data(address) } })
}

/** p2pkh-скрипт адреса: base58 → hash160. */
function p2pkh(address: string): string {
  const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let n = 0n
  for (const c of address) n = n * 58n + BigInt(BASE58.indexOf(c))
  return `76a914${n.toString(16).padStart(50, '0').slice(2, 42)}88ac`
}
