import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Смоук главных экранов для гостя на подменной ноде (support/mock-node.ts):
 * лента с постами и авторами, опрос с итогами из голосов-комментариев,
 * пост «для подписчиков» под заглушкой, страница поста, профиль без описания,
 * справка без входа и страницы аккаунта: гостя они возвращают на главную с окном входа.
 * Сеть не нужна, публикаций нет.
 */

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const BOB = { address: 'PBmockBob22222222222222222222222222', name: 'tester_bob' }
const CAROL = { address: 'PCmockCarol333333333333333333333333', name: 'tester_carol' }

const POST_TEXT = 'Проверочный пост: как мы съездили на море'
const POLL_TXID = 'b'.repeat(64)
const SUBSCRIBERS_ONLY_TEXT = 'Этот текст видят только подписчики Кэрол'

const DATA: MockNodeData = {
  profiles: [ALICE, BOB, CAROL],
  posts: [
    { txid: 'a'.repeat(64), address: ALICE.address, message: POST_TEXT, tags: ['море'] },
    {
      txid: POLL_TXID,
      address: BOB.address,
      message: 'Выбираем напиток для встречи',
      tags: ['опрос'],
      settings: { poll: { title: 'Чай или кофе?', list: ['Чай', 'Кофе'] } },
      comments: 4,
    },
    {
      txid: 'c'.repeat(64),
      address: CAROL.address,
      message: SUBSCRIBERS_ONLY_TEXT,
      tags: ['секрет'],
      settings: { f: '1' },
    },
  ],
  comments: [
    {
      id: 'v1',
      postid: POLL_TXID,
      address: ALICE.address,
      message: '',
      pollVote: { index: 0, option: 'Чай' },
    },
    {
      id: 'v2',
      postid: POLL_TXID,
      address: CAROL.address,
      message: '',
      pollVote: { index: 0, option: 'Чай' },
    },
    {
      id: 'v3',
      postid: POLL_TXID,
      address: BOB.address,
      message: '',
      pollVote: { index: 1, option: 'Кофе' },
    },
    { id: 'c1', postid: POLL_TXID, address: CAROL.address, message: 'Я за чай с лимоном' },
  ],
}

async function open(page: Page, path: string) {
  await useMockNode(page, DATA)
  await page.goto(path)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  // Чистый профиль — первый запуск: «Что нового» перекрывает страницу.
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

test.describe('Главные экраны для гостя', () => {
  test('лента показывает посты с авторами', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByText(POST_TEXT)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(ALICE.name).first()).toBeVisible()
    await expect(page).toHaveTitle(/.+/)
  })

  test('опрос в ленте: гость видит итоги по голосам-комментариям', async ({ page }) => {
    await open(page, '/')
    const poll = page.getByRole('group', { name: 'Опрос' })
    await expect(poll).toBeVisible({ timeout: 20_000 })
    await expect(poll.getByText('Чай или кофе?')).toBeVisible()
    await expect(poll.getByText('67%')).toBeVisible({ timeout: 15_000 })
    await expect(poll.getByText('33%')).toBeVisible()
    await expect(poll.getByText('3 голоса')).toBeVisible()
  })

  test('пост «для подписчиков» гость видит заглушкой, без текста', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByText('Автор открыл этот пост только подписчикам').first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(SUBSCRIBERS_ONLY_TEXT)).toHaveCount(0)
  })

  test('страница поста открывается по ссылке', async ({ page }) => {
    await open(page, `/post/${'a'.repeat(64)}`)
    await expect(page.getByText(POST_TEXT)).toBeVisible({ timeout: 20_000 })
  })

  test('профиль без «О себе» показывает адрес, эксплорер и дату регистрации', async ({ page }) => {
    await open(page, `/${ALICE.address}`)
    await expect(page.getByTitle('Скопировать адрес')).toHaveText(ALICE.address, {
      timeout: 20_000,
    })
    await expect(page.getByText('Открыть в блок-эксплорере')).toBeVisible()
    await expect(page.getByText('Регистрация:')).toBeVisible()
  })

  test('справка открывается без входа, статья — по ссылке из содержания', async ({ page }) => {
    await open(page, '/help')
    await expect(page.getByRole('heading', { name: 'Справка' }).first()).toBeVisible({
      timeout: 20_000,
    })
    await page.getByRole('link', { name: 'Частые вопросы' }).first().click()
    await expect(page).toHaveURL(/\/help\/faq$/)
    await expect(page.getByRole('heading', { name: 'Частые вопросы' }).first()).toBeVisible()
  })

  for (const path of ['/settings', '/wallets']) {
    test(`гость с ${path} попадает на главную и видит окно входа`, async ({ page }) => {
      await open(page, path)
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 })
      await expect(page.getByRole('dialog', { name: 'Вход в аккаунт' })).toBeVisible()
    })
  }
})
