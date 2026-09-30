import { createHash } from 'node:crypto'
import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Продвижение поста за PKOIN, от кнопки до транзакции: вход тестовым
 * мнемоником, у поста «Продвинуть», прогноз по ленте бустов, отправка. Нода
 * подменная: монеты на адресе — один выдуманный выход на 20 PKOIN, отправку
 * тест перехватывает и разбирает байты транзакции. В сеть ничего не уходит.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const POST_TXID = 'e'.repeat(64)
const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [
    {
      txid: POST_TXID,
      address: ALICE.address,
      message: 'Пост для продвижения',
      type: 'share',
    },
  ],
  comments: [],
}

const PKOIN = 100_000_000
const UTXO_PKOIN = 20
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** p2pkh-скрипт адреса: 76a914 <hash160> 88ac (hash160 — из base58check). */
function p2pkhScript(address: string): string {
  let n = 0n
  for (const c of address) n = n * 58n + BigInt(BASE58.indexOf(c))
  const hex = n.toString(16).padStart(50, '0')
  return `76a914${hex.slice(2, 42)}88ac`
}

const hash256 = (text: string): string =>
  createHash('sha256').update(createHash('sha256').update(text).digest()).digest('hex')

/** Выходы транзакции Pocketnet: version, nTime, входы, выходы, locktime. */
function txOutputs(hex: string): { value: bigint; script: string }[] {
  const b = Buffer.from(hex, 'hex')
  let o = 8
  const varint = (): number => {
    const first = b[o++]!
    if (first < 0xfd) return first
    if (first === 0xfd) return ((o += 2), b.readUInt16LE(o - 2))
    return ((o += 4), b.readUInt32LE(o - 4))
  }
  const inputs = varint()
  for (let i = 0; i < inputs; i++) {
    o += 36
    const script = varint()
    o += script + 4
  }
  const outs: { value: bigint; script: string }[] = []
  const count = varint()
  for (let i = 0; i < count; i++) {
    const value = b.readBigUInt64LE(o)
    o += 8
    const length = varint()
    outs.push({ value, script: b.subarray(o, o + length).toString('hex') })
    o += length
  }
  return outs
}

/** Монеты, лента бустов и отправка — поверх подменной ноды (маршруты страницы главнее). */
async function useWallet(page: Page): Promise<{ sent: unknown[][] }> {
  const state = { sent: [] as unknown[][] }
  const rpc = (method: string) => new RegExp(`\\.pocketnet\\.app:8899/rpc(-ex)?/${method}`)
  const answer = (route: Route, data: unknown) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ headers: CORS, json: { result: 'success', data } })

  await page.route(rpc('txunspent'), (route) => {
    if (route.request().method() === 'OPTIONS') return answer(route, null)
    const [[address]] = route.request().postDataJSON().parameters as [[string]]
    return answer(route, [
      {
        txid: 'c'.repeat(64),
        vout: 0,
        address,
        amount: UTXO_PKOIN,
        amountSat: UTXO_PKOIN * PKOIN,
        confirmations: 120,
        scriptPubKey: p2pkhScript(address),
      },
    ])
  })
  // У двух других постов 30 PKOIN: 2,5 PKOIN дают 25 %, до 100 % нужно 10.
  await page.route(rpc('getboostfeed'), (route) =>
    answer(route, {
      height: 4_037_000,
      boosts: [
        { txid: 'a'.repeat(64), boost: 20 * PKOIN },
        { txid: 'b'.repeat(64), boost: 10 * PKOIN },
      ],
    })
  )
  await page.route(rpc('sendrawtransactionwithmessage'), (route) => {
    if (route.request().method() === 'OPTIONS') return answer(route, null)
    state.sent.push(route.request().postDataJSON().parameters as unknown[])
    return answer(route, 'f'.repeat(64))
  })
  return state
}

async function signIn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

test('продвижение поста: прогноз, сумма до 100 % и транзакция contentBoost', async ({ page }) => {
  test.setTimeout(90_000)
  await useMockNode(page, DATA)
  const wallet = await useWallet(page)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await signIn(page)

  const card = page.getByRole('article').filter({ hasText: 'Пост для продвижения' })
  await card.getByRole('button', { name: 'Продвинуть' }).click()

  const dialog = page.getByRole('dialog', { name: 'Продвинуть пост' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('«Пост для продвижения»')).toBeVisible()
  await expect(dialog.getByText(`Доступно: ${UTXO_PKOIN} PKOIN`)).toBeVisible()

  await dialog.getByRole('button', { name: '2.5', exact: true }).click()
  await expect(dialog.getByText(/ленты «Русский» примерно на сутки: 25\s?%/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Для 100 %: 10 PKOIN' }).click()
  await expect(dialog.getByRole('spinbutton')).toHaveValue('10')
  await expect(dialog.getByText(/примерно на сутки: 100\s?%/)).toBeVisible()

  await dialog.getByRole('button', { name: 'Продвинуть', exact: true }).click()
  await expect(page.getByText(/Пост продвинут/)).toBeVisible({ timeout: 20_000 })
  await expect(dialog).toBeHidden()

  // Отправлено то, что понимает нода: hex, payload и тип операции.
  expect(wallet.sent).toHaveLength(1)
  const [hex, payload, type] = wallet.sent[0] as [string, unknown, string]
  expect(payload).toEqual({ content: POST_TXID })
  expect(type).toBe('contentBoost')

  // OP_RETURN — тип и хэш txid поста; сдача — всё, кроме буста и 1 сатоши комиссии.
  const outs = txOutputs(hex)
  expect(outs).toHaveLength(2)
  expect(outs[0]!.script).toBe(
    `6a0c${Buffer.from('contentBoost').toString('hex')}20${hash256(POST_TXID)}`
  )
  expect(outs[0]!.value).toBe(0n)
  expect(outs[1]!.value).toBe(BigInt((UTXO_PKOIN - 10) * PKOIN - 1))
})
