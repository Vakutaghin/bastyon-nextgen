import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { primeMessengerProfiles } from './support/offline-messenger'

/**
 * Поиск по переписке, как в Telegram: лента остаётся целиком, найденное —
 * «1 из 10», самое свежее сразу посередине экрана с рамкой и подсвеченными
 * словами; Enter — старше, Shift+Enter — новее; далёкое найденное открывает
 * ленту на себе, «к последним» возвращает вниз; Esc сбрасывает поиск. Без
 * сервера чатов: переписка — в сторе.
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
const DIALOGS = [
  { id: DM, partner: { id: mx(BOB), name: 'bob_ng' }, unreadCount: 0, createdAt: NOW - 86_400_000 },
]

/** 200 сообщений; у каждого двадцатого — «Планы на отпуск №k». */
const MESSAGES = Array.from({ length: 200 }, (_, i) => ({
  id: `$m${i}`,
  senderId: i % 2 ? mx(BOB) : 'me',
  text: i % 20 === 5 ? `Планы на отпуск №${i}` : `Сообщение ${i}`,
  timestamp: NOW - (200 - i) * 60_000,
}))

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
}

/** Список чатов и переписка DM в сторах, мессенджер во весь экран. */
async function openChat(page: Page): Promise<void> {
  await primeMessengerProfiles(page, DATA.profiles)
  await page.evaluate(
    async ({ dialogs, dm, messages }) => {
      const stores = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const ui = stores.get('messenger-ui') as Record<string, unknown> & {
        setDialogs: (d: unknown) => void
        switchToChat: (id: string) => void
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
      await (stores.get('messenger') as { openMessenger: () => Promise<void> }).openMessenger()
      ui.isFullScreen = true
      ui.switchToChat(dm)
    },
    { dialogs: DIALOGS, dm: DM, messages: MESSAGES }
  )
  await expect(page.getByText('Сообщение 199')).toBeVisible({ timeout: 30_000 })
}

const row = (page: Page, n: number) => page.locator(`[data-message-id="$m${n}"]`)

/** Сообщение видно в ленте целиком. */
async function inView(page: Page, n: number): Promise<boolean> {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-message-id="${id}"]`)
    const list = document.querySelector('[data-testid="message-list"]')
    if (!el || !list) return false
    const r = el.getBoundingClientRect()
    const l = list.getBoundingClientRect()
    return r.top >= l.top && r.bottom <= l.bottom
  }, `$m${n}`)
}

test.describe.configure({ timeout: 90_000 })

test('найденное перебирается стрелками, лента на месте, слова подсвечены', async ({ page }) => {
  await signedIn(page)
  await openChat(page)
  const search = page.getByTestId('chat-search')
  const count = page.getByTestId('chat-search-count')

  await search.fill('отпу')
  await expect(count).toHaveText('1 из 10')
  // Самое свежее — посередине, с рамкой; лента не отфильтрована.
  await expect(row(page, 185).locator('.found')).toHaveCount(1)
  expect(await inView(page, 185)).toBe(true)
  await expect(row(page, 186)).toHaveCount(1)
  // Слова подсвечены поверх текста (CSS Custom Highlight API).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const css = CSS as unknown as { highlights?: Map<string, { size: number }> }
        return css.highlights?.get('chat-search-current')?.size ?? -1
      })
    )
    .toBe(1)

  await search.press('Enter')
  await search.press('Enter')
  await expect(count).toHaveText('3 из 10')
  await expect(row(page, 145).locator('.found')).toHaveCount(1)
  expect(await inView(page, 145)).toBe(true)

  await search.press('Shift+Enter')
  await expect(count).toHaveText('2 из 10')
  await expect(row(page, 165).locator('.found')).toHaveCount(1)

  await page.getByTestId('chat-search-newer').click()
  await expect(count).toHaveText('1 из 10')
})

test('далёкое найденное — лента открывается на нём; «к последним» — вниз', async ({ page }) => {
  await signedIn(page)
  await openChat(page)
  const search = page.getByTestId('chat-search')
  await search.fill('отпуск')
  await expect(page.getByTestId('chat-search-count')).toHaveText('1 из 10')
  for (let i = 0; i < 9; i++) await search.press('Enter')
  await expect(page.getByTestId('chat-search-count')).toHaveText('10 из 10')
  await expect(row(page, 5).locator('.found')).toHaveCount(1)
  expect(await inView(page, 5)).toBe(true)
  // Низ ленты не нарисован — к нему кнопка.
  await expect(row(page, 199)).toHaveCount(0)
  const toLatest = page.getByTestId('to-latest')
  await expect(toLatest).toBeVisible()

  await toLatest.click()
  await expect(row(page, 199)).toBeVisible()
  await expect(toLatest).toHaveCount(0)
})

test('ничего не нашлось — «Не найдено»; Esc сбрасывает поиск, чат открыт', async ({ page }) => {
  await signedIn(page)
  await openChat(page)
  const search = page.getByTestId('chat-search')
  await search.fill('самокат')
  await expect(page.getByTestId('chat-search-count')).toHaveText('Не найдено')
  await expect(page.getByText('Сообщение 199')).toBeVisible()
  await search.press('Escape')
  await expect(search).toHaveValue('')
  await expect(page.getByTestId('chat-search-count')).toHaveCount(0)
  await expect(page.getByText('Сообщение 199')).toBeVisible()
})
