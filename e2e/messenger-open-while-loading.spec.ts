import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Чат открыт, история ещё грузится, а человек уже пишет: отправленное сразу
 * встаёт внизу, у поля ввода, с часами «ещё не отправлено», а история
 * догружается над ним. Раньше чат до конца загрузки был закрыт заставкой, и
 * казалось, что сообщения улетают в никуда. Сервера чатов нет: загрузка
 * истории подставлена в сторы, вход в Matrix оборван — отправка ждёт комнату.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
const DATA: MockNodeData = { profiles: [{ address: BOB, name: 'bob_ng' }], posts: [], comments: [] }
const DM = '!dm:matrix.pocketnet.app'

test('пишешь, пока грузится история: сообщение внизу с часами, история — над ним', async ({
  page,
}) => {
  test.setTimeout(120_000)
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

  await page.evaluate(
    async ({ dm, bob }) => {
      const s = (
        document.querySelector('#app') as unknown as {
          __vue_app__: {
            config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
          }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const ui = s.get('messenger-ui') as Record<string, unknown> & {
        setDialogs: (d: unknown[]) => void
        switchToChat: (id: string) => void
      }
      ui.setDialogs([{ id: dm, partner: { id: bob, name: 'bob_ng' }, unreadCount: 0 }])
      await (s.get('messenger') as { openMessenger: () => Promise<void> }).openMessenger()
      ;(s.get('messenger-chat') as { messages: Record<string, unknown[]> }).messages[dm] = []
      ui.switchToChat(dm)
      ui.isMessagesLoading = true
    },
    { dm: DM, bob: mx(BOB) }
  )

  // Показать пока нечего — заставка.
  await expect(page.getByText('Загрузка сообщений...')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('message-list')).toHaveCount(0)

  const input = page.getByPlaceholder('Введите сообщение...')
  await input.fill('Пишу, пока грузится')
  await page.getByRole('button', { name: 'Отправить сообщение' }).click()

  // Сообщение сразу в ленте, у поля ввода, с часами; над ним — строка загрузки.
  const list = page.getByTestId('message-list')
  const mine = list.getByText('Пишу, пока грузится')
  await expect(mine).toBeVisible()
  await expect(list.locator('svg[data-pending]')).toHaveCount(1)
  await expect(list.getByTestId('history-loading')).toBeVisible()
  const listBox = (await list.boundingBox())!
  const mineBox = (await mine.boundingBox())!
  expect(listBox.y + listBox.height - (mineBox.y + mineBox.height)).toBeLessThan(60)

  // История пришла: старые сообщения над своим, своё по-прежнему последнее.
  await page.evaluate(
    ({ dm, bob }) => {
      const s = (
        document.querySelector('#app') as unknown as {
          __vue_app__: {
            config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
          }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const chat = s.get('messenger-chat') as { messages: Record<string, { timestamp: number }[]> }
      const pending = chat.messages[dm]!
      const now = Date.now()
      const old = Array.from({ length: 30 }, (_, i) => ({
        id: `$h${i}`,
        chatId: dm,
        senderId: bob,
        text: `Старое ${String(i + 1).padStart(2, '0')}`,
        timestamp: now - 3_600_000 + i * 60_000,
        read: true,
        status: 'sent',
      }))
      chat.messages[dm] = [...old, ...pending]
      ;(s.get('messenger-ui') as Record<string, unknown>).isMessagesLoading = false
    },
    { dm: DM, bob: mx(BOB) }
  )

  await expect(list.getByText('Старое 30')).toBeVisible()
  await expect(list.getByTestId('history-loading')).toHaveCount(0)
  await expect(mine).toBeVisible()
  const after = (await mine.boundingBox())!
  expect(listBox.y + listBox.height - (after.y + after.height)).toBeLessThan(60)
  // Своё — последнее в ленте.
  const texts = await list.locator('.message-text').allInnerTexts()
  expect(texts.at(-1)).toContain('Пишу, пока грузится')
  expect(texts.at(-2)).toContain('Старое 30')
})
