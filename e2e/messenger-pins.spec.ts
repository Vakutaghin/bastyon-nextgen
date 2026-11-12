import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Закреплённые чаты: закреплённый — сверху списка, хоть последнее сообщение
 * в нём и старше; у него булавка, пока нет нового. Меню «⋯» — «Закрепить» или
 * «Открепить». Сервер чатов закрыт: закрепить не выходит — сказано, порядок
 * прежний. Диалоги подставлены в стор, профили — с подменной ноды.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ANNA = 'PAnnaMockAddress111111111111111111'
const BORIS = 'PBorisMockAddress11111111111111111'
const VERA = 'PVeraMockAddress111111111111111111'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`

const DATA: MockNodeData = {
  profiles: [
    { address: ANNA, name: 'anna_ng', reputation: 300 },
    { address: BORIS, name: 'boris_ng', reputation: 300 },
    { address: VERA, name: 'vera_ng', reputation: 300 },
  ],
  posts: [],
  comments: [],
}

const PROFILE_RELOAD_SETTLE = 2_500
const NOW = Date.now()

function dialog(id: string, partner: string, name: string, ago: number, extra = {}) {
  return {
    id,
    partner: { id: mx(partner), name },
    unreadCount: 0,
    lastMessage: {
      id: `$${id.slice(1)}`,
      chatId: id,
      senderId: mx(partner),
      text: `привет от ${name}`,
      timestamp: NOW - ago,
      read: true,
      status: 'sent',
    },
    ...extra,
  }
}

const DIALOGS = [
  dialog('!anna:matrix.pocketnet.app', ANNA, 'anna_ng', 0),
  dialog('!boris:matrix.pocketnet.app', BORIS, 'boris_ng', 3_600_000),
  // Самый старый, но закреплён.
  dialog('!vera:matrix.pocketnet.app', VERA, 'vera_ng', 2 * 86_400_000, { pinned: 0.5 }),
]

type Stores = Map<string, Record<string, unknown>>
const stores = (page: Page, fn: (s: Stores, arg: unknown) => unknown, arg?: unknown) =>
  page.evaluate(
    ([body, a]) => {
      const app = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__
      return new Function('s', 'a', `return (${body})(s, a)`)(
        app.config.globalProperties.$pinia._s,
        a
      )
    },
    [fn.toString(), arg] as const
  )

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
  await stores(page, (s) => (s.get('messenger')!.openMessenger as () => Promise<void>)())
  // Сервер чатов закрыт: сначала сбой входа и профили, потом чаты (как в messenger-screen).
  await expect(page.getByText('Не удалось войти в мессенджер', { exact: false })).toBeVisible({
    timeout: 30_000,
  })
  await stores(
    page,
    (s, profiles) => {
      const cache = s.get('messenger-profile-cache')!.userProfiles as Record<string, unknown>
      for (const p of profiles as { address: string }[]) cache[p.address] = { ...p }
    },
    DATA.profiles
  )
  await page.waitForTimeout(PROFILE_RELOAD_SETTLE)
  await stores(
    page,
    (s, dialogs) => (s.get('messenger-ui')!.setDialogs as (d: unknown) => void)(dialogs),
    DIALOGS
  )
}

const rows = (page: Page) => page.getByTestId('chat-row')
const row = (page: Page, name: string) => rows(page).filter({ hasText: name })

async function openRowMenu(page: Page, name: string): Promise<void> {
  const r = row(page, name)
  await r.hover()
  await r.locator('.dots-btn').click()
}

test('закреплённый чат — сверху с булавкой; меню закрепляет и открепляет', async ({ page }) => {
  test.setTimeout(120_000)
  await signedInWithDialogs(page)

  await expect(row(page, 'vera_ng')).toBeVisible({ timeout: 30_000 })
  await expect(rows(page).nth(0)).toContainText('vera_ng')
  await expect(rows(page).nth(1)).toContainText('anna_ng')
  await expect(rows(page).nth(2)).toContainText('boris_ng')
  await expect(row(page, 'vera_ng').getByTestId('chat-pinned-mark')).toBeVisible()
  await expect(row(page, 'anna_ng').getByTestId('chat-pinned-mark')).toHaveCount(0)
  await row(page, 'vera_ng').screenshot({ path: 'test-results/pinned-row.png' })

  await openRowMenu(page, 'vera_ng')
  await expect(page.getByTestId('pin-toggle')).toHaveText(/Открепить/)
  // Закрыть меню — щелчком по подложке под ним.
  await page.locator('[data-styled-name="SC_Overlay"]').click({ position: { x: 5, y: 5 } })
  await expect(page.getByTestId('pin-toggle')).toHaveCount(0)

  // Сервер чатов закрыт — закрепить не выходит: сказано, порядок прежний.
  await openRowMenu(page, 'boris_ng')
  await expect(page.getByTestId('pin-toggle')).toHaveText(/Закрепить/)
  await page.getByTestId('pin-toggle').click()
  await expect(page.getByText('Не удалось закрепить чат')).toBeVisible({ timeout: 10_000 })
  await expect(rows(page).nth(0)).toContainText('vera_ng')
  await expect(rows(page).nth(2)).toContainText('boris_ng')
  await expect(row(page, 'boris_ng').getByTestId('chat-pinned-mark')).toHaveCount(0)
})

test('новое сообщение в другом чате не сдвигает закреплённый', async ({ page }) => {
  test.setTimeout(120_000)
  await signedInWithDialogs(page)
  await expect(rows(page).nth(0)).toContainText('vera_ng', { timeout: 30_000 })

  // Борису пришло новое: он выше Анны, но ниже закреплённой Веры.
  // Стор держит список по времени — как после настоящего синка.
  const fresh = DIALOGS.map((d) =>
    d.id.startsWith('!boris')
      ? { ...d, unreadCount: 2, lastMessage: { ...d.lastMessage, timestamp: Date.now() + 1000 } }
      : d
  ).sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp)
  await stores(
    page,
    (s, dialogs) => (s.get('messenger-ui')!.setDialogs as (d: unknown) => void)(dialogs),
    fresh
  )
  await expect(rows(page).nth(0)).toContainText('vera_ng')
  await expect(rows(page).nth(1)).toContainText('boris_ng')
  await expect(rows(page).nth(2)).toContainText('anna_ng')
})
