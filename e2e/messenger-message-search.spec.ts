import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { settleOfflineMessenger } from './support/offline-messenger'

/**
 * Сообщения в поиске над списком чатов, как в Telegram: найденное во всех
 * чатах — от новых к старым, с чатом, автором и подсвеченными словами;
 * нажатие открывает чат на сообщении, и поиск по переписке уже стоит на нём
 * с тем же запросом; выдача остаётся. Сервер чатов закрыт: переписка — в сторе.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`

const DATA: MockNodeData = {
  profiles: [{ address: BOB, name: 'bob_ng' }],
  posts: [],
  comments: [],
}

const NOW = Date.now()
const DM = '!dm:matrix.pocketnet.app'
const FAMILY = '!family:matrix.pocketnet.app'

/** 200 сообщений с Бобом; у каждого двадцатого — «Планы на отпуск №k». */
const MESSAGES = Array.from({ length: 200 }, (_, i) => ({
  id: `$m${i}`,
  senderId: i % 2 ? mx(BOB) : 'me',
  text: i % 20 === 5 ? `Планы на отпуск №${i}` : `Сообщение ${i}`,
  timestamp: NOW - (200 - i) * 60_000,
}))

const DIALOGS = [
  {
    id: FAMILY,
    partner: { id: FAMILY, name: 'Семья' },
    unreadCount: 0,
    group: { memberCount: 3, previewIds: [mx(BOB)] },
    // Группу не открывали: найдётся её последнее сообщение из списка.
    lastMessage: {
      id: '$family-last',
      chatId: FAMILY,
      senderId: mx(BOB),
      text: 'Летим в отпуск в июле',
      timestamp: NOW - 30_000,
      read: true,
      status: 'sent',
    },
  },
  { id: DM, partner: { id: mx(BOB), name: 'bob_ng' }, unreadCount: 0, createdAt: NOW - 86_400_000 },
]

type Stores = Map<string, Record<string, unknown>>

async function signedIn(page: Page): Promise<void> {
  await page.route('**/_matrix/**', (route) => route.abort())
  await useMockNode(page, DATA)
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
  await settleOfflineMessenger(page, DATA.profiles)
}

/** Список чатов и переписка с Бобом в сторах, мессенджер во весь экран. */
async function withChats(page: Page): Promise<void> {
  await page.evaluate(
    ({ dialogs, dm, messages }) => {
      const stores = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const ui = stores.get('messenger-ui') as Record<string, unknown> & {
        setDialogs: (d: unknown) => void
      }
      const chat = stores.get('messenger-chat') as {
        messages: Record<string, unknown[]>
        history: Record<string, unknown>
        currentUser: { id: string }
      }
      const me = chat.currentUser.id
      chat.messages[dm] = messages.map((m) => ({
        chatId: dm,
        read: true,
        status: 'sent',
        ...m,
        senderId: m.senderId === 'me' ? me : m.senderId,
      }))
      chat.history[dm] = { reachedStart: true }
      ui.setDialogs(dialogs)
      ui.isFullScreen = true
    },
    { dialogs: DIALOGS, dm: DM, messages: MESSAGES }
  )
}

test.describe.configure({ timeout: 120_000 })

test('сообщения во всех чатах; нажатие открывает чат на найденном с тем же запросом', async ({
  page,
}) => {
  await signedIn(page)
  await withChats(page)

  await page.getByTestId('chat-search-open').click()
  await page.getByTestId('chat-search-input').fill('отпуск')
  const results = page.getByTestId('chat-search-results')
  const hits = results.getByTestId('chat-search-message')
  // Десять у Боба и последнее сообщение группы; самое свежее — сверху.
  await expect(hits).toHaveCount(11, { timeout: 15_000 })
  await expect(hits.first()).toContainText('Семья')
  await expect(hits.first()).toContainText('bob_ng: Летим в отпуск в июле')
  await expect(hits.first().locator('mark')).toHaveText('отпуск')
  await expect(hits.nth(1)).toContainText('Планы на отпуск №185')
  await expect(results).toContainText('Всю историю чата ищет поиск внутри него')

  // Самое старое — чат открывается на нём, «10 из 10», рамка, на экране.
  await hits.filter({ hasText: '№5' }).first().click()
  const search = page.getByTestId('chat-search')
  // Без сервера чатов чат открывается до 30 секунд — переход ждёт ленту.
  await expect(search).toHaveValue('отпуск', { timeout: 45_000 })
  await expect(page.getByTestId('chat-search-count')).toHaveText('10 из 10')
  const row = page.locator('[data-message-id="$m5"]')
  await expect(row.locator('.found')).toHaveCount(1)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.querySelector('[data-message-id="$m5"]')
        const list = document.querySelector('[data-testid="message-list"]')
        if (!el || !list) return false
        const r = el.getBoundingClientRect()
        const l = list.getBoundingClientRect()
        return r.top >= l.top && r.bottom <= l.bottom
      })
    )
    .toBe(true)

  // Стрелки дальше — по найденному в этом чате; выдача слева осталась.
  await page.getByTestId('chat-search-newer').click()
  await expect(page.getByTestId('chat-search-count')).toHaveText('9 из 10')
  await expect(results).toBeVisible()
})
