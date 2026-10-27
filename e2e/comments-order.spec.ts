import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockComment, type MockNodeData } from './support/mock-node'

/**
 * Порядок обсуждения не скачет. Комментарий, который был виден под постом,
 * после «Загрузить ещё» остаётся первым, даже при «Сначала интересные».
 * «Загрузить ещё» только добавляет снизу. «Обновить» (и обновление по WS —
 * тот же путь) не сворачивает показанное и не переставляет его, хотя у
 * одного комментария появились лайки и пришёл новый.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const BOB = { address: 'PAmockBob11111111111111111111111', name: 'tester_bob' }
const POST = 'e'.repeat(64)

const comment = (i: number, extra: Partial<MockComment> = {}): MockComment => ({
  id: `c${String(i).padStart(2, '0')}`.padEnd(64, '0'),
  postid: POST,
  address: i % 2 ? ALICE.address : BOB.address,
  message: `Комментарий номер ${i}`,
  ...extra,
})

function data(): MockNodeData {
  const comments = Array.from({ length: 40 }, (_, i) => comment(i, i === 5 ? { scoreUp: 50 } : {}))
  return {
    profiles: [ALICE, BOB],
    posts: [
      {
        txid: POST,
        address: ALICE.address,
        message: 'Пост с обсуждением',
        comments: 40,
        lastComment: comments[39]!.id,
      },
    ],
    comments,
  }
}

/** Номера видимых комментариев сверху вниз. */
const visible = (page: Page): Promise<number[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter(
        (e) =>
          e.childElementCount === 0 && /^Комментарий номер \d+$/.test(e.textContent?.trim() ?? '')
      )
      .map((e) => Number(e.textContent!.trim().split(' ').pop()))
  )

test('«Загрузить ещё» и «Обновить» не переставляют показанные комментарии', async ({ page }) => {
  test.setTimeout(90_000)
  const node = data()
  await useMockNode(page, node)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  // Порядок обсуждения — в настройках, а они только у вошедшего.
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const signIn = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await signIn.locator('input, textarea').first().fill(MNEMONIC)
  await signIn.getByRole('button', { name: 'Войти' }).click()
  await expect(signIn).toBeHidden({ timeout: 30_000 })
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Общие', exact: true }).click()
  await page.getByRole('button', { name: 'Сначала интересные' }).click()

  await page.goto('/')
  await expect(page.getByText('Пост с обсуждением').first()).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => visible(page)).toEqual([39])

  await page.getByRole('button', { name: 'Загрузить ещё' }).first().click()
  await expect.poll(async () => (await visible(page)).length).toBe(16)
  const first = await visible(page)
  // Был виден под постом — остался первым; дальше — «интересные», лайкнутый 5-й.
  expect(first[0]).toBe(39)
  expect(first[1]).toBe(5)

  await page.getByRole('button', { name: 'Загрузить ещё' }).first().click()
  await expect.poll(async () => (await visible(page)).length).toBe(31)
  const second = await visible(page)
  expect(second.slice(0, 16)).toEqual(first)

  // У 20-го появились лайки (по «интересности» он ушёл бы наверх), пришёл новый.
  node.comments[20] = { ...node.comments[20]!, scoreUp: 100 }
  node.comments.push(comment(40))
  await page.getByRole('button', { name: 'Обновить', exact: true }).click()
  // Показанное не свернулось и не переставилось; новый встал по сортировке, и
  // окно стало на один шире, чтобы никто из показанных не уехал вниз.
  await expect.poll(async () => (await visible(page)).length).toBe(32)
  const refreshed = await visible(page)
  expect(refreshed.filter((n) => second.includes(n))).toEqual(second)

  await page.getByRole('button', { name: 'Загрузить ещё' }).first().click()
  await expect.poll(async () => (await visible(page)).length).toBe(41)
  const all = await visible(page)
  expect(all).toContain(40)
  expect(all.filter((n) => second.includes(n))).toEqual(second)
})
