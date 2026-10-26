import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Люди и блокировки, как в старом клиенте: комментарии, которые автор поста
 * закрыл блокировкой, свёрнуты у всех; меню поста блокирует автора; списки
 * подписчиков без заблокированных владельцем; отписка и (раз)блокировка
 * переспрашивают поверх окон; в профиле — адреса для пожертвований, они же в
 * окне чаевых. Транзакции подменная нода не принимает — до сети ничего не доходит.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PBobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const CAROL = 'PCaroooooooooooooooooooooooooooooo'
const DAVE = 'PDaveeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const ERIN = 'PErinnnnnnnnnnnnnnnnnnnnnnnnnnnnnn'
const POST = 'a'.repeat(64)
const DAVE_POST = 'd'.repeat(64)
const BTC = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'

function makeData(): MockNodeData {
  return {
    profiles: [
      { address: ME, name: 'me_ng', blocking: [DAVE] },
      {
        address: ALICE,
        name: 'alice_ng',
        blocking: [BOB],
        subscribers: [BOB, CAROL, DAVE],
        donations: [{ currency: 'btc', address: BTC }],
      },
      { address: BOB, name: 'bob_ng' },
      { address: CAROL, name: 'carol_ng', reputation: 5 },
      { address: DAVE, name: 'dave_ng' },
      { address: ERIN, name: 'erin_ng' },
    ],
    posts: [
      { txid: POST, address: ALICE, message: 'Пост Алисы', comments: 3, lastComment: 'c-bob' },
      { txid: DAVE_POST, address: DAVE, message: 'Пост Дейва' },
    ],
    comments: [
      {
        id: 'c-bob',
        postid: POST,
        address: BOB,
        message: 'Комментарий Боба',
        blockedByPostAuthor: true,
      },
      { id: 'c-carol', postid: POST, address: CAROL, message: 'Заходите на spam.shop' },
      { id: 'c-erin', postid: POST, address: ERIN, message: 'Обычный комментарий' },
    ],
    subscribes: [ALICE],
  }
}

async function signIn(page: Page, data: MockNodeData): Promise<void> {
  await useMockNode(page, data)
  await page.route('**/_matrix/**', (route) => route.abort())
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

/** Подтверждение antd с этим заголовком — и что оно не под другим окном. */
async function expectConfirmOnTop(page: Page, title: string): Promise<Locator> {
  const confirm = page.locator('.ant-modal-confirm').filter({ hasText: title })
  await expect(confirm).toBeVisible()
  const cancel = confirm.getByRole('button', { name: 'Отмена' })
  const box = await cancel.boundingBox()
  expect(box).not.toBeNull()
  const onTop = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.ant-modal-confirm'),
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
  )
  expect(onTop).toBe(true)
  return confirm
}

test('комментарии под постом: блокировка автором поста и ссылка новичка свёрнуты', async ({
  page,
}) => {
  await signIn(page, makeData())
  await page.goto(`/post/${POST}`)
  await page.getByRole('button', { name: 'Загрузить ещё' }).click({ timeout: 20_000 })

  const bob = page.locator('[data-comment-id="c-bob"]')
  await expect(bob).toContainText('Скрыто: автор публикации заблокировал этого пользователя', {
    timeout: 20_000,
  })
  await expect(bob).not.toContainText('Комментарий Боба')
  await expect(page.locator('[data-comment-id="c-carol"]')).toContainText(
    'Скрыто: ссылка на сторонний сайт от аккаунта с низкой репутацией'
  )
  await expect(page.locator('[data-comment-id="c-erin"]')).toContainText('Обычный комментарий')

  await bob.getByRole('button', { name: 'Показать всё равно' }).click()
  await expect(bob).toContainText('Комментарий Боба')
})

test('превью последнего комментария в ленте свёрнуто так же', async ({ page }) => {
  await signIn(page, makeData())
  const card = page.locator('.post-card').filter({ hasText: 'Пост Алисы' })
  await expect(card).toContainText('Скрыто: автор публикации заблокировал этого пользователя', {
    timeout: 30_000,
  })
  await expect(card).not.toContainText('Комментарий Боба')
  // Пост того, кого заблокировал я, в ленту не попадает.
  await expect(page.locator('.post-card').filter({ hasText: 'Пост Дейва' })).toHaveCount(0)
})

test('меню поста: «Заблокировать автора» переспрашивает, у заблокированного — «Разблокировать»', async ({
  page,
}) => {
  await signIn(page, makeData())
  await page.goto(`/post/${POST}`)
  const card = page.locator('.post-card').filter({ hasText: 'Пост Алисы' })
  await card.getByRole('button', { name: 'Поделиться' }).click({ timeout: 30_000 })
  await page.getByTestId('post-block-author').click()
  const confirm = await expectConfirmOnTop(page, 'Заблокировать пользователя?')
  await confirm.getByRole('button', { name: 'Отмена' }).click()
  await expect(confirm).toBeHidden()

  await page.goto(`/post/${DAVE_POST}`)
  const daveCard = page.locator('.post-card').filter({ hasText: 'Пост Дейва' })
  await daveCard.getByRole('button', { name: 'Поделиться' }).click({ timeout: 30_000 })
  await expect(page.getByTestId('post-block-author')).toHaveText('Разблокировать автора')
})

test('подписчики: без заблокированных владельцем, «Разблокировать» поверх окна', async ({
  page,
}) => {
  await signIn(page, makeData())
  await page.goto(`/${ALICE}`)
  await page
    .getByRole('button', { name: /Подписчики/ })
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 })

  const list = page.getByRole('dialog', { name: 'Подписчики' })
  await expect(list).toContainText('carol_ng', { timeout: 20_000 })
  await expect(list).toContainText('dave_ng')
  await expect(list).not.toContainText('bob_ng')

  const dave = list
    .locator('li, div')
    .filter({ hasText: /^dave_ng/ })
    .last()
  await list.getByRole('button', { name: 'Разблокировать' }).click()
  const confirm = await expectConfirmOnTop(page, 'Разблокировать пользователя?')
  await confirm.getByRole('button', { name: 'Отмена' }).click()
  await expect(dave).toBeVisible()
})

test('отписка переспрашивает', async ({ page }) => {
  await signIn(page, makeData())
  await page.goto(`/${ALICE}`)
  const subscribed = page.getByRole('button', { name: 'Вы подписаны' }).filter({ visible: true })
  await subscribed.first().click({ timeout: 30_000 })
  const confirm = await expectConfirmOnTop(page, 'Отписаться от пользователя?')
  await confirm.getByRole('button', { name: 'Отмена' }).click()
  await expect(subscribed.first()).toBeVisible()
})

test('профиль: адреса для пожертвований и занятое имя', async ({ page }) => {
  await signIn(page, makeData())
  await page.goto(`/${ME}`)
  await page
    .getByRole('button', { name: 'Редактировать профиль' })
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 })

  const dialog = page.getByRole('dialog', { name: 'Редактировать профиль' })
  const save = dialog.getByRole('button', { name: 'Сохранить' })
  await expect(save).toBeDisabled()

  const address = dialog.getByPlaceholder('Адрес кошелька')
  await address.fill('не адрес')
  await dialog.getByRole('button', { name: 'Добавить' }).click()
  await expect(dialog).toContainText('Это не похоже на адрес Bitcoin (BTC)')

  await address.fill(BTC)
  await dialog.getByRole('button', { name: 'Добавить' }).click()
  await expect(dialog.locator('li').filter({ hasText: BTC })).toBeVisible()
  await expect(save).toBeEnabled()

  await dialog.getByLabel('Имя').fill('alice_ng')
  await save.click()
  await expect(page.getByText('Это имя уже занято')).toBeVisible({ timeout: 20_000 })
  await expect(dialog).toBeVisible()
})

test('окно чаевых показывает кошельки получателя', async ({ page }) => {
  await signIn(page, makeData())
  await page.goto(`/post/${POST}`)
  const card = page.locator('.post-card').filter({ hasText: 'Пост Алисы' })
  await card.getByRole('button', { name: 'Чаевые' }).first().click({ timeout: 30_000 })
  const dialog = page.getByRole('dialog', { name: 'Чаевые автору' })
  await expect(dialog).toContainText('Или переведите в другой валюте', { timeout: 20_000 })
  await expect(dialog).toContainText(BTC)
  await expect(dialog).toContainText('Bitcoin (BTC)')
})
