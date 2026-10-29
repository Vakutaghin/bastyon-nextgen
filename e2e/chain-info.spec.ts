import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «В блокчейне»: окно поверх ленты с тем, что записано о посте, комментарии
 * и аккаунте. Открыл, прошёл по ссылкам внутри, закрыл — лента на том же
 * месте и страница та же. Ответы ноды — формы mainnet 23.10.2026: у правленого
 * поста `hash` — последняя версия, `versions` — прежние; getcontentactions
 * повторяет оценку столько раз, сколько версий профиля у оценившего.
 */

const AUTHOR = { address: 'PAmockAuthor111111111111111111111', name: 'chain_author' }
const VOTER = { address: 'PVmockVoter1111111111111111111111', name: 'voter_one' }
const VOTER2 = { address: 'PVmockVoter2222222222222222222222', name: 'voter_two' }
const BOOSTER = { address: 'PBmockBooster11111111111111111111', name: 'booster' }

const TARGET = '7a'.repeat(32)
const EDIT1 = '7b'.repeat(32)
const CURRENT = '7c'.repeat(32)
const COMMENT = '7d'.repeat(32)
const TARGET_TEXT = 'Пост, который правили дважды'
const COMMENT_TEXT = 'Комментарий с монетами автору'

const NOW = Math.floor(Date.now() / 1000)
const HEIGHT = 4_036_000

const LONG = 'Длинный текст, чтобы лента прокручивалась. '.repeat(12)

const DATA: MockNodeData = {
  profiles: [AUTHOR, VOTER, VOTER2, BOOSTER],
  posts: [
    ...Array.from({ length: 6 }, (_, i) => ({
      txid: (i + 1).toString(16).padStart(2, '0').repeat(32),
      address: AUTHOR.address,
      message: `Пост ${i + 1}. ${LONG}`,
    })),
    { txid: TARGET, address: AUTHOR.address, message: TARGET_TEXT, comments: 1 },
    ...Array.from({ length: 4 }, (_, i) => ({
      txid: (i + 0x20).toString(16).padStart(2, '0').repeat(32),
      address: AUTHOR.address,
      message: `Пост после ${i + 1}. ${LONG}`,
    })),
  ],
  comments: [{ id: COMMENT, postid: TARGET, address: VOTER.address, message: COMMENT_TEXT }],
}

function tx(txid: string, type: number, height: number, extra: Record<string, unknown> = {}) {
  return {
    txid,
    type,
    height,
    blockHash: 'e'.repeat(64),
    nTime: NOW - (HEIGHT - height) * 60,
    s1: AUTHOR.address,
    s2: TARGET,
    vin: [{ txid: 'f'.repeat(64), vout: 1, address: AUTHOR.address, value: 2 }],
    vout: [
      { n: 0, value: 0, scriptPubKey: { addresses: [], hex: '6a' } },
      { n: 1, value: 1.9999, scriptPubKey: { addresses: [AUTHOR.address], hex: '' } },
    ],
    ...extra,
  }
}

const TXS: Record<string, unknown> = {
  [TARGET]: tx(TARGET, 200, HEIGHT - 300),
  [EDIT1]: tx(EDIT1, 200, HEIGHT - 200),
  [CURRENT]: tx(CURRENT, 200, HEIGHT - 100),
  // Комментарий с монетами: 1 PKOIN автору поста, сдача — комментатору.
  [COMMENT]: tx(COMMENT, 204, HEIGHT - 50, {
    s1: VOTER.address,
    s2: COMMENT,
    s3: TARGET,
    vin: [{ txid: 'f'.repeat(64), vout: 0, address: VOTER.address, value: 3 }],
    vout: [
      { n: 0, value: 0, scriptPubKey: { addresses: [], hex: '6a' } },
      { n: 1, value: 1, scriptPubKey: { addresses: [AUTHOR.address], hex: '' } },
      { n: 2, value: 1.9999, scriptPubKey: { addresses: [VOTER.address], hex: '' } },
    ],
  }),
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

/** Ответы, которых нет у общей подменной ноды. Остальное — ей (fallback). */
async function useChainNode(page: Page): Promise<void> {
  const answer = (route: Route, data: unknown) =>
    route.fulfill({ headers: CORS, json: { result: 'success', data } })

  await page.route(/\.pocketnet\.app:8899\/rpc(-ex)?\/\w+/, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fallback()
    const method = new URL(request.url()).pathname.split('/').pop()
    const params = ((request.postDataJSON() as { parameters?: unknown[] })?.parameters ??
      []) as unknown[]
    switch (method) {
      case 'getrawtransactionwithmessagebyid': {
        if (!(params[0] as string[]).includes(TARGET)) return route.fallback()
        return answer(route, [
          {
            hash: CURRENT,
            txid: TARGET,
            id: 37_000_006,
            address: AUTHOR.address,
            time: NOW - 30_000,
            l: 'ru',
            type: 'share',
            c: 'Заголовок поста',
            m: TARGET_TEXT,
            u: '',
            t: ['правки'],
            i: ['https://img.example/1.jpg', 'https://img.example/2.jpg'],
            s: { a: '', v: '', videos: [], image: '', f: '0', c: '', t: '0' },
            scoreCnt: 3,
            scoreSum: 14,
            reposted: 1,
            comments: 1,
            versions: [
              { h: HEIGHT - 300, hs: TARGET },
              { h: HEIGHT - 200, hs: EDIT1 },
            ],
            flags: {},
            lastComment: null,
            userprofile: { name: AUTHOR.name, address: AUTHOR.address, i: '' },
          },
        ])
      }
      case 'getcontentactions':
        return answer(route, {
          scores: [
            { posttxid: TARGET, address: VOTER.address, name: VOTER.name, value: 5 },
            { posttxid: TARGET, address: VOTER.address, name: 'voter_old_name', value: 5 },
            { posttxid: TARGET, address: VOTER2.address, name: VOTER2.name, value: 4 },
          ],
          // Сумма переполнена нодой — окно её не показывает.
          boosts: [
            { posttxid: TARGET, address: BOOSTER.address, name: BOOSTER.name, value: 438392524 },
          ],
          donations: [],
        })
      case 'gettransactions':
        return answer(route, (params[0] as string[]).map((id) => TXS[id]).filter(Boolean))
      case 'getuserstate':
        return answer(route, {
          address: params[0],
          trial: false,
          reputation: 42,
          badges: [],
          user_reg_date: NOW - 90 * 86_400,
          user_reg_height: 3_900_000,
          balance: 1_250_000_000,
        })
      case 'getaddressregistration':
        return answer(route, [
          { address: VOTER.address, time: NOW - 90 * 86_400, txid: '9a'.repeat(32) },
        ])
      case 'getaddressinfo':
        return answer(route, { address: params[0], balance: 12.5, lastChange: HEIGHT - 50 })
      case 'getaccountearning':
        return answer(route, [
          {
            address: params[0],
            amountLottery: 50_000_000,
            amountDonation: 300_000_000,
            amountTransfer: 0,
          },
        ])
      case 'getaddresstransactions':
        return answer(route, [{ ...(TXS[COMMENT] as object), rowNumber: 0 }])
      default:
        return route.fallback()
    }
  })
}

async function openFeed(page: Page): Promise<void> {
  await useMockNode(page, DATA)
  await useChainNode(page)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

test('пост «В блокчейне»: версии, оценки, переходы внутри окна; лента на месте', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openFeed(page)

  const card = page.getByRole('article').filter({ hasText: TARGET_TEXT })
  await card.scrollIntoViewIfNeeded({ timeout: 20_000 })
  await card.getByRole('button', { name: 'Поделиться' }).click()
  // Меню длинное: пункт может оказаться ниже края окна — сначала к нему.
  const item = page.getByRole('button', { name: 'В блокчейне' })
  await item.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  const scrollBefore = await page.evaluate(() => window.scrollY)
  expect(scrollBefore).toBeGreaterThan(200)
  await item.click()

  const dialog = page.getByRole('dialog', { name: /В блокчейне/ })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(AUTHOR.name)
  await expect(dialog).toContainText('Правок: 2')
  await expect(dialog).toContainText('Заголовок поста')
  await expect(dialog).toContainText('#правки')
  await expect(dialog).toContainText('Картинок: 2')
  await expect(dialog).toContainText('★ 4.7')
  await expect(dialog).toContainText('1 / 1')

  // Версии: публикация, правка, текущая.
  await expect(dialog.getByRole('button', { name: /Публикация/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Правка 2.*текущая/ })).toBeVisible()

  // Оценка от двух версий профиля — один человек; сумма буста не показана.
  const voters = dialog.getByRole('button', { name: /voter_/ })
  await expect(voters).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: 'booster' })).toBeVisible()
  await expect(dialog).not.toContainText('4.38')

  // Правка → её транзакция в том же окне, «Назад» — обратно к посту.
  await dialog.getByRole('button', { name: /Правка 1/ }).click()
  await expect(dialog).toContainText(EDIT1)
  await dialog.getByRole('button', { name: 'Назад' }).click()
  await expect(dialog).toContainText('Правок: 2')

  // Человек из оценивших → его аккаунт.
  await dialog.getByRole('button', { name: /voter_two/ }).click()
  await expect(dialog).toContainText('Баланс')
  await expect(dialog).toContainText('12.5 PKOIN')
  await expect(dialog).toContainText('Заработок за всё время')
  await expect(dialog).toContainText('Последние транзакции')

  // Закрыли — та же страница, лента там же.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(new URL(page.url()).pathname).toBe('/')
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
})

test('модалка не отбрасывает ленту наверх (окно входа у гостя)', async ({ page }) => {
  // Раньше любая модалка antd сбрасывала прокрутку в 0: `overflow-x: hidden`
  // у html не давал её блокировке дойти до окна, и документ схлопывался.
  test.setTimeout(90_000)
  await openFeed(page)
  const card = page.getByRole('article').filter({ hasText: TARGET_TEXT })
  await card.scrollIntoViewIfNeeded({ timeout: 20_000 })
  await page.waitForTimeout(300)
  const scrollBefore = await page.evaluate(() => window.scrollY)
  expect(scrollBefore).toBeGreaterThan(200)

  await card.getByRole('button', { name: 'Продвинуть' }).click()
  const auth = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await expect(auth).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
  await auth.locator('.ant-modal-close').click()
  await expect(auth).toBeHidden()
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
})

test('«Открыть в блокчейн-обозревателе» уводит на страницу транзакции и закрывает окно', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openFeed(page)
  const card = page.getByRole('article').filter({ hasText: TARGET_TEXT })
  await card.scrollIntoViewIfNeeded({ timeout: 20_000 })
  await card.getByRole('button', { name: 'Поделиться' }).click()
  await page.getByRole('button', { name: 'В блокчейне' }).click()

  const dialog = page.getByRole('dialog', { name: /В блокчейне/ })
  await expect(dialog).toContainText('Правок: 2')
  await dialog.getByRole('link', { name: 'Открыть в блокчейн-обозревателе' }).click()
  await expect(page).toHaveURL(new RegExp(`/explorer/tx/${TARGET}$`))
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('комментарий «В блокчейне»: текст, монеты автору поста, переход к посту', async ({ page }) => {
  test.setTimeout(90_000)
  await useMockNode(page, DATA)
  await useChainNode(page)
  await page.route(/\.pocketnet\.app:8899\/rpc\/getcomments/, async (route) => {
    // Запрос одного комментария по id — как его просит окно.
    const params = (route.request().postDataJSON() as { parameters?: unknown[] })?.parameters
    if (route.request().method() === 'OPTIONS' || !Array.isArray(params?.[3])) {
      return route.fallback()
    }
    return route.fulfill({
      headers: CORS,
      json: {
        result: 'success',
        data: [
          {
            type: 204,
            id: COMMENT,
            postid: TARGET,
            address: VOTER.address,
            time: NOW - 3000,
            timeUpd: NOW - 1000,
            block: HEIGHT - 50,
            msg: JSON.stringify({ message: COMMENT_TEXT, url: '', images: [], info: '' }),
            scoreUp: 3,
            scoreDown: 1,
            children: 2,
            deleted: false,
            edit: true,
            flags: {},
          },
        ],
      },
    })
  })
  await page.goto(`/post/${TARGET}`)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})

  // Обсуждение свёрнуто: «Загрузить ещё» разворачивает комментарии.
  await page.getByRole('button', { name: 'Загрузить ещё' }).click({ timeout: 20_000 })
  const comment = page.locator(`[data-comment-id="${COMMENT}"]`)
  await expect(comment).toBeVisible({ timeout: 20_000 })
  await comment.getByRole('button', { name: 'Действия' }).click()
  await page.getByRole('button', { name: 'В блокчейне' }).click()

  const dialog = page.getByRole('dialog', { name: /В блокчейне/ })
  await expect(dialog).toContainText(COMMENT_TEXT)
  await expect(dialog).toContainText('Монеты автору поста')
  await expect(dialog).toContainText('1 PKOIN')
  await expect(dialog).toContainText('+3 / −1')

  // К посту — в том же окне.
  await dialog.getByRole('button', { name: /^7a7a/ }).click()
  await expect(dialog).toContainText('Правок: 2')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(new URL(page.url()).pathname).toBe(`/post/${TARGET}`)
})
