import { test, expect, type Locator, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { p2pkhScript } from './support/p2pkh'

/**
 * Оценка поста уходит в сеть не сразу: несколько секунд её можно поменять
 * другой звездой или отменить — потом сеть её изменить не даст. Нода подменная,
 * отправку тест перехватывает.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = {
  profiles: [ALICE, { address: ME, name: 'tester_me', reputation: 500 }],
  posts: ['e', 'd'].map((c, i) => ({
    txid: c.repeat(64),
    address: ALICE.address,
    message: `Пост для оценки ${i + 1}`,
    type: 'share',
    scores: 3,
  })),
  comments: [],
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface SentVote {
  share: string
  value: string
}

async function useWallet(page: Page): Promise<SentVote[]> {
  const sent: SentVote[] = []
  const rpc = (method: string) => new RegExp(`\\.pocketnet\\.app:8899/rpc(-ex)?/${method}`)
  const answer = (route: Route, data: unknown) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ headers: CORS, json: { result: 'success', data } })
  await page.route(rpc('txunspent'), (route) => {
    if (route.request().method() === 'OPTIONS') return answer(route, null)
    const [[address]] = route.request().postDataJSON().parameters as [[string]]
    return answer(
      route,
      ['c', 'b'].map((c) => ({
        txid: c.repeat(64),
        vout: 0,
        address,
        amount: 1,
        amountSat: 100_000_000,
        confirmations: 120,
        scriptPubKey: p2pkhScript(address),
      }))
    )
  })
  await page.route(rpc('sendrawtransactionwithmessage'), (route) => {
    if (route.request().method() === 'OPTIONS') return answer(route, null)
    const [, data, type] = route.request().postDataJSON().parameters as [string, SentVote, string]
    expect(type).toBe('upvoteShare')
    sent.push(data)
    return answer(route, 'f'.repeat(64))
  })
  return sent
}

async function start(page: Page): Promise<SentVote[]> {
  await useMockNode(page, DATA)
  const sent = await useWallet(page)
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
  return sent
}

const card = (page: Page, n: number): Locator =>
  page.getByRole('article').filter({ hasText: `Пост для оценки ${n}` })
const star = (post: Locator, n: number): Locator => post.locator(`[data-star="${n}"]`)
const undo = (post: Locator): Locator => post.getByTestId('rating-undo')
const filled = (post: Locator): Promise<number> => post.locator('.star-fill').count()

for (const size of [
  { name: 'компьютер', width: 1366, height: 900, hasTouch: false },
  { name: 'телефон', width: 360, height: 780, hasTouch: true },
]) {
  test.describe(size.name, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.hasTouch,
    })
    test.setTimeout(120_000)

    const press = (target: Locator) => (size.hasTouch ? target.tap() : target.click())

    test('промах по звезде исправляется, отмена ничего не отправляет', async ({ page }) => {
      const sent = await start(page)
      const post = card(page, 1)
      await post.scrollIntoViewIfNeeded()

      await press(star(post, 4))
      await expect(undo(post)).toBeVisible()
      await expect(undo(post)).toContainText('Отменить')
      expect(await filled(post)).toBe(4)
      // Кнопка помещается в карточку.
      const box = (await undo(post).boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(size.width)

      // Отмена: звёзды пустые, числа прежние, в сеть ничего.
      await press(undo(post))
      await expect(undo(post)).toBeHidden()
      await expect.poll(() => filled(post)).toBe(0)
      await expect(post.getByTestId('post-scores-open')).toContainText('3')
      await page.waitForTimeout(6_000)
      expect(sent).toEqual([])

      // Промахнулись и поправили: уходит одна оценка — последняя.
      await press(star(post, 4))
      await expect(undo(post)).toBeVisible()
      await press(star(post, 5))
      expect(await filled(post)).toBe(5)
      await expect
        .poll(() => sent, { timeout: 15_000 })
        .toEqual([{ share: 'e'.repeat(64), value: '5' }])
      await expect(undo(post)).toBeHidden()
      await expect(post.getByTestId('post-scores-open')).toContainText('4')
      expect(await filled(post)).toBe(5)

      // Отправленную уже не изменить.
      await expect(star(post, 1)).toHaveAttribute('aria-disabled', 'true')
      await star(post, 1).click({ force: true })
      await expect(undo(post)).toBeHidden()
      expect(await filled(post)).toBe(5)
    })
  })
}

test('окно закрыли посреди ожидания — оценка уходит после перезапуска', async ({ page }) => {
  test.setTimeout(120_000)
  const sent = await start(page)
  const post = card(page, 2)
  await star(post, 5).click()
  await expect(undo(post)).toBeVisible()
  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await expect
    .poll(() => sent, { timeout: 30_000 })
    .toEqual([{ share: 'd'.repeat(64), value: '5' }])
})
