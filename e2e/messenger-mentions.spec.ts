import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Упоминания в групповом чате, как в Telegram. Формат в тексте — как у
 * прежнего Bastyon и Forta Chat: `@<hex адреса>:<имя>`; человек видит «@имя»
 * ссылкой на профиль, в списке чатов — «@имя» текстом, а не hex.
 * Сервера чатов нет: группа и переписка подставлены в стор.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const CAROL = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const hex = (address: string) => Buffer.from(address).toString('hex')
const mx = (address: string) => `@${hex(address)}:matrix.pocketnet.app`
const DATA: MockNodeData = {
  profiles: [
    { address: ME, name: 'me_ng' },
    { address: BOB, name: 'bob_ng' },
    { address: CAROL, name: 'carol_ng' },
  ],
  posts: [],
  comments: [],
}
const GROUP = '!team:matrix.pocketnet.app'

type Stores = Map<string, Record<string, unknown>>

async function signIn(page: Page): Promise<void> {
  await page.route('**/_matrix/**', (route) => route.abort())
  await useMockNode(page, DATA)
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
}

/** Группа «Команда» из трёх человек; в ней сообщение Кэрол с упоминаниями. */
async function openGroup(page: Page, text: string): Promise<void> {
  await page.evaluate(
    async ({ group, me, bob, carol, text }) => {
      const s = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const ui = s.get('messenger-ui') as unknown as {
        setDialogs: (d: unknown[]) => void
        switchToChat: (id: string) => void
      }
      const message = {
        id: '$mention',
        chatId: group,
        senderId: carol,
        senderName: 'carol_ng',
        text,
        timestamp: Date.now() - 60_000,
        read: true,
        status: 'sent',
      }
      ui.setDialogs([
        {
          id: group,
          partner: { id: group, name: 'Команда' },
          unreadCount: 0,
          lastMessage: message,
          group: { memberCount: 3, previewIds: [bob, carol] },
        },
      ])
      await (
        s.get('messenger') as unknown as { openMessenger: () => Promise<void> }
      ).openMessenger()
      const chat = s.get('messenger-chat') as unknown as {
        messages: Record<string, unknown[]>
        currentUser: { id: string }
      }
      chat.currentUser.id = me
      chat.messages[group] = [message]
      ui.switchToChat(group)
    },
    { group: GROUP, me: mx(ME), bob: mx(BOB), carol: mx(CAROL), text }
  )
}

test('упоминание из прежнего Bastyon: «@имя» ссылкой на профиль, своё подсвечено, в списке без hex', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signIn(page)
  await page.setViewportSize({ width: 1400, height: 900 })
  await openGroup(page, `@${hex(BOB)}:bob_ng глянь, и @${hex(ME)}:me_ng тоже`)

  const list = page.getByTestId('message-list')
  const mentions = list.getByTestId('mention')
  await expect(mentions).toHaveCount(2, { timeout: 30_000 })
  await expect(mentions.nth(0)).toHaveText('@bob_ng')
  await expect(mentions.nth(1)).toHaveText('@me_ng')
  await expect(mentions.nth(1)).toHaveClass(/\bme\b/)
  await expect(mentions.nth(0)).not.toHaveClass(/\bme\b/)
  // Текст вокруг — как был, hex нигде не виден.
  const bubble = list.locator('.message-text').first()
  await expect(bubble).toHaveText('@bob_ng глянь, и @me_ng тоже')
  expect(await page.locator('body').innerText()).not.toContain(hex(BOB))

  // В списке чатов — «@имя» текстом.
  await page.evaluate(() => {
    const s = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
      }
    ).__vue_app__.config.globalProperties.$pinia._s
    ;(
      s.get('messenger-ui') as unknown as { switchToChat: (id: string | null) => void }
    ).switchToChat(null)
  })
  await expect(page.getByText('@bob_ng глянь, и @me_ng тоже')).toBeVisible({ timeout: 10_000 })
  expect(await page.locator('body').innerText()).not.toContain(hex(BOB))

  // Нажатие — профиль упомянутого.
  await page.evaluate((group) => {
    const s = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
      }
    ).__vue_app__.config.globalProperties.$pinia._s
    ;(s.get('messenger-ui') as unknown as { switchToChat: (id: string) => void }).switchToChat(
      group
    )
  }, GROUP)
  await mentions.nth(0).click()
  await expect(page).toHaveURL(new RegExp(`/${BOB}$`))
})
