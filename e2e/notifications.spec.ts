import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Уведомления: у большинства событий нода присылает только адрес
 * отправителя. Пока его профиль грузится, в карточке скелетоны имени и
 * аватара, потом — ник, а не начало адреса.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const POST = 'a'.repeat(64)
const COMMENT = 'c'.repeat(64)
const HEIGHT = 4_037_000

const DATA: MockNodeData = {
  profiles: [
    { address: ME, name: 'me_ng' },
    { address: ALICE, name: 'alice_ng' },
  ],
  posts: [{ txid: POST, address: ME, message: 'Мой пост', ago: 600 }],
  comments: [],
}

async function signIn(page: Page): Promise<{ answerProfile: () => void }> {
  await useMockNode(page, DATA)
  // Комментарий Алисы: в событии только её адрес, без имени.
  await page.route(/\.pocketnet\.app:8899\/.*getmissedinfo/, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        result: 'success',
        data: [
          { block: HEIGHT, contentsLang: {} },
          {
            mesType: 'comment',
            txid: COMMENT,
            time: Math.floor(Date.now() / 1000) - 60,
            nblock: HEIGHT - 1,
            posttxid: POST,
            addrFrom: ALICE,
            comment: { id: COMMENT, postid: POST, msg: JSON.stringify({ message: 'Отлично!' }) },
          },
        ],
      },
    })
  )
  // Профиль Алисы отвечает, только когда тест разрешит.
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  await page.route(/\.pocketnet\.app:8899\/.*getuserprofile/, async (route) => {
    const body = route.request().postData() ?? ''
    if (body.includes(ALICE)) await gate
    await route.fallback()
  })

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
  return { answerProfile: release }
}

test('ник отправителя вместо адреса, пока грузится — скелетоны', async ({ page }) => {
  const { answerProfile } = await signIn(page)

  await page.getByRole('banner').getByRole('button', { name: 'Уведомления' }).click()
  const menu = page.locator('.header-notifications-dropdown')
  await expect(menu.getByText('Отлично!')).toBeVisible({ timeout: 30_000 })
  await expect(menu.getByTestId('actor-name-skeleton')).toBeVisible()
  await expect(menu.getByTestId('actor-avatar-skeleton')).toBeVisible()
  await expect(menu.getByText(ALICE.slice(0, 8))).toHaveCount(0)

  answerProfile()
  await expect(menu.getByText('alice_ng')).toBeVisible({ timeout: 15_000 })
  await expect(menu.getByTestId('actor-name-skeleton')).toHaveCount(0)
  await expect(menu.getByText(ALICE.slice(0, 8))).toHaveCount(0)
})

/**
 * Комментарии в уведомлениях — в том виде, в каком их присылает настоящая
 * нода (сверено 27.10.2026): у комментария и ответа нет текста, у оценки
 * комментария — даже поста, только `commentid`. Раньше такая оценка вела в
 * профиль оценившего, а комментарии в списке были без текста.
 */
const BOB = 'PBobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const ALICE_POST = 'b'.repeat(64)
const MY_COMMENT = 'd'.repeat(64)
const ANSWER = 'e'.repeat(64)
const MY_REPLY = 'f'.repeat(64)

const THREADS: MockNodeData = {
  profiles: [
    { address: ME, name: 'me_ng' },
    { address: ALICE, name: 'alice_ng' },
    { address: BOB, name: 'bob_ng' },
  ],
  posts: [
    { txid: POST, address: ME, message: 'Мой пост', ago: 600, comments: 2 },
    { txid: ALICE_POST, address: ALICE, message: 'Пост Алисы', ago: 900, comments: 2 },
  ],
  comments: [
    // Алиса — к моему посту; я ей уже ответил.
    { id: COMMENT, postid: POST, address: ALICE, message: 'Отлично!' },
    {
      id: MY_REPLY,
      postid: POST,
      address: ME,
      message: 'Спасибо!',
      parentid: COMMENT,
      answerid: COMMENT,
    },
    // Мой комментарий к посту Алисы: она его оценила, Боб ответил.
    { id: MY_COMMENT, postid: ALICE_POST, address: ME, message: 'Мой комментарий' },
    {
      id: ANSWER,
      postid: ALICE_POST,
      address: BOB,
      message: 'Согласен',
      parentid: MY_COMMENT,
      answerid: MY_COMMENT,
    },
  ],
}

async function signInWithThreads(page: Page): Promise<void> {
  await useMockNode(page, THREADS)
  const now = Math.floor(Date.now() / 1000)
  await page.route(/\.pocketnet\.app:8899\/.*getmissedinfo/, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        result: 'success',
        data: [
          { block: HEIGHT, contentsLang: {} },
          {
            msg: 'event',
            mesType: 'cScore',
            txid: '1'.repeat(64),
            commentid: MY_COMMENT,
            upvoteVal: 1,
            addrFrom: ALICE,
            time: now - 30,
            nblock: HEIGHT + 3,
          },
          {
            msg: 'comment',
            mesType: 'answer',
            reason: 'answer',
            txid: ANSWER,
            posttxid: ALICE_POST,
            parentid: MY_COMMENT,
            answerid: MY_COMMENT,
            addrFrom: BOB,
            time: now - 60,
            nblock: HEIGHT + 2,
          },
          {
            msg: 'comment',
            mesType: 'post',
            txid: COMMENT,
            posttxid: POST,
            parentid: '',
            answerid: '',
            addrFrom: ALICE,
            time: now - 90,
            nblock: HEIGHT + 1,
          },
        ],
      },
    })
  )
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

async function openBell(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Уведомления' }).click()
  return page.locator('.header-notifications-dropdown')
}

test('оценка комментария ведёт к комментарию в посте, а не в профиль', async ({ page }) => {
  test.setTimeout(120_000)
  await signInWithThreads(page)
  const menu = await openBell(page)
  const score = menu.getByTestId('notification-item').filter({ hasText: 'оценил ваш комментарий' })
  // Текст комментария теперь догружается — его видно в уведомлении.
  await expect(score.getByText('Мой комментарий')).toBeVisible({ timeout: 30_000 })

  await score.getByText('оценил ваш комментарий').click()
  const post = page.getByRole('dialog', { name: 'Пост' })
  await expect(post.getByText('Пост Алисы')).toBeVisible({ timeout: 30_000 })
  await expect(post.locator(`[data-comment-id="${MY_COMMENT}"]`)).toHaveClass(/is-highlighted/)
  await expect(page).not.toHaveURL(new RegExp(ALICE))
})

test('«Ответить» на ответ: окно поста у ответа, форма с обращением в фокусе', async ({ page }) => {
  test.setTimeout(120_000)
  await signInWithThreads(page)
  const menu = await openBell(page)
  const answer = menu
    .getByTestId('notification-item')
    .filter({ hasText: 'ответил на ваш комментарий' })
  await expect(answer.getByText('Согласен')).toBeVisible({ timeout: 30_000 })

  await answer.getByRole('button', { name: 'Ответить' }).click()
  const post = page.getByRole('dialog', { name: 'Пост' })
  // Ветка раскрыта, ответ подсвечен, форма ответа ему — с «@bob_ng,» и в фокусе.
  await expect(post.locator(`[data-comment-id="${ANSWER}"]`)).toHaveClass(/is-highlighted/, {
    timeout: 30_000,
  })
  const field = post.locator('textarea:focus')
  await expect(field).toHaveValue('@bob_ng, ')
})

test('фильтр «Комментарии», «Вы ответили» и профиль по имени', async ({ page }) => {
  test.setTimeout(120_000)
  await signInWithThreads(page)
  const menu = await openBell(page)
  await expect(menu.getByText('Мой комментарий')).toBeVisible({ timeout: 30_000 })

  // Новых комментариев два: комментарий и ответ (оценка — не комментарий).
  const comments = menu.getByRole('button', { name: /Комментарии/ })
  await expect(comments).toContainText('2')
  await comments.click()
  await expect(comments).toHaveAttribute('aria-pressed', 'true')
  // Оценка комментария — не комментарий: в фильтре её нет.
  await expect(menu.getByText('оценил ваш комментарий')).toHaveCount(0)
  await expect(menu.getByRole('button', { name: 'Ответить' })).toHaveCount(2)

  // На комментарий Алисы я уже ответил — это видно; на ответ Боба — нет.
  const alice = menu
    .getByTestId('notification-item')
    .filter({ hasText: 'прокомментировал ваш пост' })
  await expect(alice.getByText('Вы ответили')).toBeVisible({ timeout: 30_000 })
  const bob = menu
    .getByTestId('notification-item')
    .filter({ hasText: 'ответил на ваш комментарий' })
  await expect(bob.getByText('Вы ответили')).toHaveCount(0)

  await menu.getByRole('button', { name: 'Профиль: alice_ng' }).click()
  await expect(page).toHaveURL(new RegExp(`/${ALICE}$`))
})
