import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Попал ли свой пост в блокчейн — видно без перезапуска. Пост ушёл в сеть:
 * в профиле он с пометкой «Ещё не опубликовано в блокчейне». Нода начала
 * отдавать транзакцию в блоке — пометка уходит сама, приходит тост, и лента
 * подменяет карточку настоящим постом. Событий WS по адресу нет (подменная
 * нода), так что статус узнаётся опросом ноды — как и при пропущенном событии.
 * Пост, так и не попавший в блок, остаётся с пометкой и «Убрать».
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const TXID = 'f'.repeat(64)
const TEXT = 'Проверка: пост ждёт блока'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const PKOIN = 100_000_000
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** p2pkh-скрипт адреса: 76a914 <hash160> 88ac (hash160 — из base58check). */
function p2pkhScript(address: string): string {
  let n = 0n
  for (const c of address) n = n * 58n + BigInt(BASE58.indexOf(c))
  const hex = n.toString(16).padStart(50, '0')
  return `76a914${hex.slice(2, 42)}88ac`
}

function nodeData(): MockNodeData {
  return {
    profiles: [{ address: ME, name: 'me_ng' }],
    posts: [{ txid: 'a'.repeat(64), address: ME, message: 'Старый пост', ago: 86_400 }],
    comments: [],
  }
}

/** Монеты, отправка и статус транзакции — поверх подменной ноды. */
async function useChain(page: Page): Promise<{ sent: number; inBlock: boolean }> {
  const state = { sent: 0, inBlock: false }
  const rpc = (method: string) => new RegExp(`\\.pocketnet\\.app:8899/rpc(-ex)?/${method}$`)
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
        amount: 5,
        amountSat: 5 * PKOIN,
        confirmations: 120,
        scriptPubKey: p2pkhScript(address),
      },
    ])
  })
  await page.route(rpc('getrawtransaction'), (route) =>
    answer(
      route,
      state.inBlock ? { txid: TXID, blockhash: 'b'.repeat(64), confirmations: 1 } : { txid: TXID }
    )
  )
  await page.route(rpc('sendrawtransactionwithmessage'), (route) => {
    if (route.request().method() === 'OPTIONS') return answer(route, null)
    state.sent += 1
    return answer(route, TXID)
  })
  return state
}

async function start(page: Page, data: MockNodeData): Promise<void> {
  await useMockNode(page, data)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

/** Без перезагрузки: page.goto под нагрузкой снова показывал «Что нового». */
async function go(page: Page, path: string): Promise<void> {
  await page.evaluate(
    (p) =>
      (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $router: { push(p: string): void } } } }
        }
      ).__vue_app__.config.globalProperties.$router.push(p),
    path
  )
}

test('пост попал в блок — пометка уходит сама, без перезапуска', async ({ page }) => {
  test.setTimeout(120_000)
  const data = nodeData()
  const chain = await useChain(page)
  await start(page, data)
  await go(page, `/${ME}`)

  await page.getByRole('button', { name: 'Создать пост' }).click()
  const composer = page
    .getByRole('dialog')
    .filter({ has: page.getByPlaceholder('Что у вас нового?') })
  await composer.getByPlaceholder('Что у вас нового?').fill(TEXT)
  const tags = composer.getByPlaceholder('Добавьте теги…')
  await tags.fill('тест')
  await tags.press('Enter')
  await composer.getByRole('button', { name: 'Опубликовать' }).click()
  await expect(page.getByText('Пост отправлен в сеть')).toBeVisible({ timeout: 30_000 })
  expect(chain.sent).toBe(1)

  const card = page.getByRole('article').filter({ hasText: TEXT })
  await expect(card.getByTestId('post-tx-pending')).toHaveText('Ещё не опубликовано в блокчейне')
  const hourglass = page.getByRole('button', { name: 'Ожидают подтверждения' })
  await expect(hourglass).toBeVisible()

  // Транзакция в блоке, лента ноды отдаёт пост. WS молчит — узнаём у ноды.
  chain.inBlock = true
  data.posts.push({ txid: TXID, address: ME, message: TEXT, ago: 30 })
  await expect(page.getByText('Пост опубликован в блокчейне')).toBeVisible({ timeout: 40_000 })
  await expect(card.getByTestId('post-tx-pending')).toHaveCount(0)
  await expect(hourglass).toBeHidden()
  // Карточка одна и уже с кнопками поста: у неопубликованного их нет.
  await expect(card).toHaveCount(1)
  await expect(card.locator('.post-actions')).toBeVisible({ timeout: 30_000 })
})

test('пост не попал в блок — пометка, текст на месте, «Убрать»', async ({ page }) => {
  // Как после перезапуска: ожидание этого аккаунта сохранено, срок уже вышел.
  await page.addInitScript(
    ({ address, txid, text }) => {
      const now = Date.now()
      localStorage.setItem(
        `BST_PENDING_POSTS_${address}`,
        JSON.stringify([
          {
            id: txid,
            address,
            caption: '',
            message: text,
            images: [],
            tags: [],
            type: 'share',
            createdAt: now - 2 * 3_600_000,
            expiresAt: now - 1,
          },
        ])
      )
    },
    { address: ME, txid: TXID, text: TEXT }
  )
  await useChain(page)
  await start(page, nodeData())
  await go(page, `/${ME}`)

  const card = page.getByRole('article').filter({ hasText: TEXT })
  const failed = card.getByTestId('post-tx-failed')
  await expect(failed).toContainText('Не попал в блокчейн', { timeout: 30_000 })
  await expect(failed).toContainText('скопируйте его и опубликуйте заново')
  // Не опубликован — без оценок и комментариев; в часах его нет.
  await expect(card.getByTestId('post-tx-pending')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ожидают подтверждения' })).toBeHidden()

  await failed.getByRole('button', { name: 'Убрать' }).click()
  await expect(card).toHaveCount(0)
  expect(
    await page.evaluate((address) => localStorage.getItem(`BST_PENDING_POSTS_${address}`), ME)
  ).toBeNull()
})
