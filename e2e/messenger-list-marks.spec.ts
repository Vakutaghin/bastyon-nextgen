import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Галочки в списке чатов у своего последнего сообщения: «…» отправляется,
 * «✓» дошло до сервера, «!» не отправилось; в личном чате без «Вы:», в группе —
 * с ним. Диалоги подставлены в стор, сервер чатов закрыт. «✓✓» по квитанциям
 * нужна настоящая комната — она в matrix-receipts.live.spec.ts.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`

const DATA: MockNodeData = {
  profiles: [
    { address: ALICE, name: 'alice_ng' },
    { address: BOB, name: 'bob_ng' },
  ],
  posts: [],
  comments: [],
}

const NOW = Date.now()
function dialog(id: string, name: string, last: Record<string, unknown>, extra = {}) {
  return {
    id,
    partner: { id: mx(BOB), name },
    unreadCount: 0,
    lastMessage: {
      id: '$x',
      chatId: id,
      senderId: 'me',
      timestamp: NOW,
      read: true,
      status: 'sent',
      ...last,
    },
    ...extra,
  }
}

const DIALOGS = [
  dialog('!sent:matrix.pocketnet.app', 'Отправленное', { id: '$sent', text: 'дошло' }),
  dialog('!sending:matrix.pocketnet.app', 'Отправляется', { id: '~local', text: 'в пути' }),
  dialog('!failed:matrix.pocketnet.app', 'Не ушло', {
    id: '~bad',
    text: 'ошибка',
    status: 'failed',
  }),
  dialog('!theirs:matrix.pocketnet.app', 'Чужое', {
    id: '$theirs',
    text: 'ответ',
    senderId: mx(BOB),
  }),
  dialog(
    '!group:matrix.pocketnet.app',
    'Группа',
    { id: '$group', text: 'всем привет' },
    { group: { memberCount: 3, previewIds: [mx(ALICE), mx(BOB)] } }
  ),
]

async function signedInWithDialogs(page: Page): Promise<void> {
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
  await page.evaluate(async (dialogs) => {
    type Store = Record<string, (...a: unknown[]) => unknown>
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
      }
    ).__vue_app__
    const stores = app.config.globalProperties.$pinia._s
    await stores.get('messenger')!.openMessenger!()
    stores.get('messenger-ui')!.setDialogs!(dialogs)
  }, DIALOGS)
}

const row = (page: Page, name: string) => page.getByTestId('chat-row').filter({ hasText: name })

test('галочки у своего последнего сообщения в списке чатов', async ({ page }) => {
  test.setTimeout(120_000)
  await signedInWithDialogs(page)

  const sent = row(page, 'Отправленное')
  await expect(sent.getByTestId('last-mark')).toHaveAttribute('data-mark', '✓', { timeout: 30_000 })
  await expect(sent.getByTestId('last-mark')).toHaveAttribute(
    'title',
    'Отправлено, ещё не прочитано'
  )
  await expect(sent).not.toContainText('Вы:')

  await expect(row(page, 'Отправляется').getByTestId('last-mark')).toHaveText('…')
  await expect(row(page, 'Не ушло').getByTestId('last-mark')).toHaveAttribute(
    'title',
    'Не отправлено'
  )
  await expect(row(page, 'Чужое').getByTestId('last-mark')).toHaveCount(0)

  const group = row(page, 'Группа')
  await expect(group.getByTestId('last-mark')).toHaveAttribute('data-mark', '✓')
  await expect(group).toContainText('Вы: всем привет')
})
