import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { settleOfflineMessenger } from './support/offline-messenger'

/**
 * Переходы по ленте чата, как в Telegram: цитата ответа ведёт к исходному
 * сообщению (подсвечено), стрелка внизу — обратно к ответу; календарь — к
 * первому сообщению выбранного дня. Сервер чатов закрыт: переписка — в сторе.
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

const DM = '!dm:matrix.pocketnet.app'
const HOUR = 3_600_000

/** Полночь 60 дней назад, по местному времени браузера (он на той же машине). */
const start = new Date()
start.setHours(0, 0, 0, 0)
start.setDate(start.getDate() - 60)
const DAY0 = start.getTime()

/** 200 сообщений раз в 6 часов — 50 дней; последнее отвечает на шестое. */
const MESSAGES = Array.from({ length: 200 }, (_, i) => ({
  id: `$m${i}`,
  senderId: i % 2 ? mx(BOB) : 'me',
  text: i === 5 ? 'Летим в отпуск в июле' : i === 199 ? 'Отлично, я с вами' : `Сообщение ${i}`,
  timestamp: DAY0 + i * 6 * HOUR,
  ...(i === 199 ? { replyTo: { id: '$m5' } } : {}),
}))

const DIALOGS = [
  { id: DM, partner: { id: mx(BOB), name: 'bob_ng' }, unreadCount: 0, createdAt: DAY0 - HOUR },
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

/** Переписка с Бобом в сторе, мессенджер во весь экран, чат открыт. */
async function openDm(page: Page): Promise<void> {
  await page.evaluate(
    ({ dialogs, dm, messages }) => {
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
      ui.isFullScreen = true
      ui.switchToChat(dm)
    },
    { dialogs: DIALOGS, dm: DM, messages: MESSAGES }
  )
  await expect(page.getByTestId('message-list')).toBeVisible({ timeout: 15_000 })
}

/** Сообщение целиком на экране ленты. */
async function inView(page: Page, id: string): Promise<boolean> {
  return page.evaluate((messageId) => {
    const el = [...document.querySelectorAll<HTMLElement>('[data-message-id]')].find(
      (n) => n.dataset.messageId === messageId
    )
    const list = document.querySelector('[data-testid="message-list"]')
    if (!el || !list) return false
    const r = el.getBoundingClientRect()
    const l = list.getBoundingClientRect()
    return r.top >= l.top - 1 && r.bottom <= l.bottom + 1
  }, id)
}

test.describe.configure({ timeout: 120_000 })

test('цитата ведёт к исходному сообщению, стрелка — обратно к ответу', async ({ page }) => {
  await signedIn(page)
  await openDm(page)

  const reply = page.locator('[data-message-id="$m199"]')
  const quote = reply.getByTestId('reply-quote')
  await expect(quote).toContainText('Летим в отпуск в июле')
  await expect(quote).toHaveAttribute('role', 'button')
  // Исходное далеко выше: в ленте ещё не нарисовано.
  await expect(page.locator('[data-message-id="$m5"]')).toHaveCount(0)

  await quote.click()
  const original = page.locator('[data-message-id="$m5"]')
  await expect(original.locator('.flash')).toHaveCount(1)
  await expect.poll(() => inView(page, '$m5')).toBe(true)

  const back = page.getByTestId('jump-back')
  await expect(back).toHaveAttribute('aria-label', 'Вернуться к ответу')
  await back.click()
  await expect.poll(() => inView(page, '$m199')).toBe(true)
  await expect(reply.locator('.flash')).toHaveCount(1)
  await expect(back).toHaveCount(0)
})

test('календарь ведёт к первому сообщению выбранного дня', async ({ page }) => {
  await signedIn(page)
  await openDm(page)

  // Десятый день: его первое сообщение — сороковое (четыре в день, с полуночи).
  const day = new Date(DAY0)
  day.setDate(day.getDate() + 10)
  const pad = (n: number) => String(n).padStart(2, '0')
  const value = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`

  const picker = page.getByTestId('chat-date-jump')
  await expect(picker).toHaveAttribute('aria-label', 'Перейти к дате')
  await picker.fill(value)
  const target = page.locator('[data-message-id="$m40"]')
  await expect(target.locator('.flash')).toHaveCount(1)
  await expect.poll(() => inView(page, '$m40')).toBe(true)
  // Возврата к ответу после перехода к дате нет; ниже не нарисовано — «к последним».
  await expect(page.getByTestId('jump-back')).toHaveCount(0)
  await expect(page.getByTestId('to-latest')).toBeVisible()
})
