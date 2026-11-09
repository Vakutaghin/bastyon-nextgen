import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «Поделиться → Отправить в чат»: пост из ленты уходит в выбранные чаты
 * ссылкой формата bastyon.com (в чате она станет карточкой поста), с
 * подписью. Сервера чатов нет: переписки подставлены в стор, вход в Matrix
 * оборван — сообщение видно в ленте чата неотправленным, это и проверяем.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
const POST = 'a'.repeat(64)
const DATA: MockNodeData = {
  profiles: [
    { address: ALICE, name: 'alice_ng' },
    { address: BOB, name: 'bob_ng' },
  ],
  posts: [{ txid: POST, address: ALICE, message: 'Пост, которым делимся', ago: 60 }],
  comments: [],
}
const DM_BOB = '!bob:matrix.pocketnet.app'
const DM_ALICE = '!alice:matrix.pocketnet.app'

/** «Что нового» этой версии уже видели: окно не встанет поверх ленты. */
const APP_VERSION = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
  .version

async function signIn(page: Page): Promise<void> {
  await page.route('**/_matrix/**', (route) => route.abort())
  await useMockNode(page, DATA)
  await page.addInitScript((version) => {
    if (!localStorage.getItem('bastyon_locale')) localStorage.setItem('bastyon_locale', 'ru')
    localStorage.setItem('bastyonChangelogLastSeenVersion', version)
  }, APP_VERSION)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const auth = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await auth.locator('input, textarea').first().fill(MNEMONIC)
  await auth.getByRole('button', { name: 'Войти' }).click()
  await expect(auth).toBeHidden({ timeout: 30_000 })
  await page.evaluate(
    ({ bob, alice, dmBob, dmAlice }) => {
      const s = (
        document.querySelector('#app') as unknown as {
          __vue_app__: {
            config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
          }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const now = Date.now()
      ;(s.get('messenger-ui') as { setDialogs: (d: unknown[]) => void }).setDialogs([
        {
          id: dmBob,
          partner: { id: bob, name: 'bob_ng' },
          unreadCount: 0,
          lastMessage: {
            id: '$1',
            chatId: dmBob,
            senderId: bob,
            text: 'Привет',
            timestamp: now - 1000,
          },
        },
        {
          id: dmAlice,
          partner: { id: alice, name: 'alice_ng' },
          unreadCount: 0,
          lastMessage: {
            id: '$2',
            chatId: dmAlice,
            senderId: alice,
            text: 'Как дела?',
            timestamp: now - 60_000,
          },
        },
      ])
    },
    { bob: mx(BOB), alice: mx(ALICE), dmBob: DM_BOB, dmAlice: DM_ALICE }
  )
}

test('пост из ленты — в чат: ссылка bastyon.com с подписью уходит в выбранный чат', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await signIn(page)
  const post = page.locator('main').getByText('Пост, которым делимся')
  await expect(post).toBeVisible({ timeout: 30_000 })

  await page.locator('main').getByRole('button', { name: 'Поделиться' }).first().click()
  await page.getByTestId('share-to-chat-action').click()
  const modal = page.getByTestId('share-to-chat')
  await expect(modal).toBeVisible()
  // Свежий чат сверху.
  await expect(modal.getByTestId('share-to-chat-name')).toHaveText(['bob_ng', 'alice_ng'])

  await modal.getByTestId('share-to-chat-row').filter({ hasText: 'bob_ng' }).click()
  await modal.getByTestId('share-to-chat-comment').fill('Глянь')
  await modal.getByTestId('share-to-chat-send').click()
  await expect(modal).toBeHidden()

  expect(await sentTo(page, DM_BOB)).toEqual([`Глянь\nhttps://bastyon.com/post?s=${POST}`])
  await expect(page.getByText('Ошибка (vue:render function)')).toHaveCount(0)
})

test('профиль — в чат: ссылка по адресу, ник можно сменить', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await signIn(page)
  // Роутером, без перезагрузки: подставленные в стор чаты остаются.
  await page.evaluate((path) => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $router: { push: (p: string) => void } } } }
      }
    ).__vue_app__
    app.config.globalProperties.$router.push(path)
  }, `/${ALICE}`)
  await page.getByTestId('profile-share').first().click({ timeout: 30_000 })
  await page.getByRole('menuitem', { name: 'Отправить в чат' }).click()
  const modal = page.getByTestId('share-to-chat')
  await expect(modal).toContainText('alice_ng')
  await modal.getByTestId('share-to-chat-row').filter({ hasText: 'bob_ng' }).click()
  await modal.getByTestId('share-to-chat-send').click()
  await expect(modal).toBeHidden()
  expect(await sentTo(page, DM_BOB)).toEqual([`https://bastyon.com/author?address=${ALICE}`])
})

/** Тексты сообщений чата в сторе — без сервера чатов они там неотправленными. */
function sentTo(page: Page, dm: string): Promise<string[]> {
  return page.evaluate((id) => {
    const s = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
        }
      }
    ).__vue_app__.config.globalProperties.$pinia._s
    const chat = s.get('messenger-chat') as { messages: Record<string, Array<{ text: string }>> }
    return (chat.messages[id] ?? []).map((m) => m.text)
  }, dm)
}
