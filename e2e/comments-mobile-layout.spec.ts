import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Ветка комментариев на телефоне не сжимается. Подписи действий не
 * переносятся внутри кнопки («1» под 👍, «Ответить автору» в две строки),
 * «Ответы (N)» — отдельной строкой под действиями, а поле ответа — почти во
 * всю ширину: аватар скрыт, эмодзи, отмена и отправка — строкой под полем.
 * На компьютере — по-прежнему: всё в одну строку, аватар у поля на месте.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PAmockBob11111111111111111111111'
const POST = 'a'.repeat(64)
const id = (s: string): string => s.padEnd(64, '0')

const DATA: MockNodeData = {
  profiles: [
    { address: ME, name: 'me_ng' },
    { address: ALICE, name: 'alice_ng' },
    { address: BOB, name: 'Konstantin_Konstantinopolsky' },
  ],
  posts: [
    {
      txid: POST,
      address: ALICE,
      message: 'Пост с веткой ответов',
      comments: 3,
      lastComment: id('c1'),
    },
  ],
  comments: [
    { id: id('c1'), postid: POST, address: ALICE, message: 'Корневой комментарий', scoreUp: 1 },
    {
      id: id('r1'),
      postid: POST,
      address: ME,
      parentid: id('c1'),
      answerid: id('c1'),
      message: 'Мой ответ',
      scoreUp: 12,
    },
    {
      id: id('r2'),
      postid: POST,
      address: BOB,
      parentid: id('c1'),
      answerid: id('r1'),
      message: 'Ответ на ответ',
    },
  ],
}

const comment = (page: Page, key: string): Locator => page.locator(`[data-comment-id="${id(key)}"]`)

async function openThread(page: Page): Promise<void> {
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  // Форма ответа — только у вошедшего.
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })

  // Без перезагрузки: page.goto под нагрузкой снова показывал «Что нового».
  await page.evaluate(
    (p) =>
      (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $router: { push(p: string): void } } } }
        }
      ).__vue_app__.config.globalProperties.$router.push(p),
    `/post/${POST}`
  )
  await page.getByRole('button', { name: 'Ответы (2)' }).first().click()
  await expect(comment(page, 'r2')).toBeVisible({ timeout: 20_000 })
  await comment(page, 'r2').getByRole('button', { name: 'Ответить', exact: true }).click()
}

type Rect = { top: number; left: number; width: number; height: number }

const rectOf = (locator: Locator): Promise<Rect> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  })

/** Строка действий комментария: подпись кнопки → её прямоугольник. */
async function actionRects(item: Locator): Promise<Map<string, Rect>> {
  const list = await item.evaluate((el) =>
    [...el.querySelectorAll(':scope > div > div:last-child > button')].map((b) => {
      const r = b.getBoundingClientRect()
      return [
        (b.textContent ?? '').trim(),
        { top: r.top, left: r.left, width: r.width, height: r.height },
      ] as const
    })
  )
  return new Map(list)
}

/** Ответ и плашка ответа под ним. */
const replyWrap = (page: Page, key: string): Locator => comment(page, key).locator('xpath=..')

test.describe('на телефоне', () => {
  test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true })

  test('действия в одну строку, «Ответы» — под ними, поле ответа во всю ширину', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openThread(page)

    for (const key of ['c1', 'r1', 'r2']) {
      const actions = await actionRects(comment(page, key))
      const reply = actions.get('Ответить')!
      const toAuthor = actions.get('Ответить автору')!
      // Подпись не ломается внутри кнопки, «Ответить автору» — в той же строке.
      for (const r of actions.values()) expect(r.height).toBeLessThanOrEqual(24)
      expect(Math.abs(toAuthor.top - reply.top)).toBeLessThan(2)
      if (key === 'c1') {
        // «Ответы (2)» — своей строкой ниже действий.
        expect(actions.get('Ответы (2)')!.top).toBeGreaterThanOrEqual(reply.top + reply.height)
      }
    }

    const wrap = replyWrap(page, 'r2')
    const form = wrap.locator('textarea')
    await expect(form).toBeVisible()
    // Было ~170px: аватар, эмодзи, отмена и отправка стояли с полем в ряд.
    const field = await rectOf(form)
    expect(field.width).toBeGreaterThan(290)
    await expect(wrap.locator('.reply-avatar, .reply-avatar-placeholder')).toBeHidden()
    const send = await rectOf(wrap.getByRole('button', { name: 'Отправить' }))
    expect(send.top).toBeGreaterThanOrEqual(field.top + field.height)

    // Ответ меньше корневого: аватар 24 против 32.
    const rootAvatar = await rectOf(comment(page, 'c1').locator('.comment-avatar-placeholder'))
    const replyAvatar = await rectOf(comment(page, 'r2').locator('.comment-avatar-placeholder'))
    expect(replyAvatar.width).toBeLessThan(rootAvatar.width)

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  })
})

test.describe('на компьютере', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('действия и форма ответа — в одну строку', async ({ page }) => {
    test.setTimeout(90_000)
    await openThread(page)

    const actions = await actionRects(comment(page, 'c1'))
    expect(Math.abs(actions.get('Ответы (2)')!.top - actions.get('Ответить')!.top)).toBeLessThan(2)

    const wrap = replyWrap(page, 'r2')
    await expect(wrap.locator('.reply-avatar, .reply-avatar-placeholder')).toBeVisible()
    const field = await rectOf(wrap.locator('textarea'))
    const send = await rectOf(wrap.getByRole('button', { name: 'Отправить' }))
    expect(send.left).toBeGreaterThan(field.left + field.width)
  })
})
