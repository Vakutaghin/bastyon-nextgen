import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Переписка на устройстве и меню сообщения. В полноэкранном мессенджере «⋯»
 * у сообщения открывает меню поверх окна, удаление спрашивает тоже поверх.
 * Сохранённое, которого на сервере уже нет, — со значком и границей. В
 * настройках «Чаты» сохранение включается, режим и выбор переживают
 * перезагрузку, копия стирается с двумя вопросами; в меню чата — «Сохранять
 * на устройстве» с подтверждением. Без сервера чатов: состояние — в сторах.
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
const DAY = 86_400_000
const DM = '!dm:matrix.pocketnet.app'
const OTHER = '!other:matrix.pocketnet.app'

const DIALOGS = [
  { id: DM, partner: { id: mx(BOB), name: 'bob_ng' }, unreadCount: 0, createdAt: NOW - 200 * DAY },
  {
    id: OTHER,
    partner: { id: mx(ALICE), name: 'alice_ng' },
    unreadCount: 0,
    createdAt: NOW - 10 * DAY,
  },
]

type Stores = Map<string, Record<string, unknown>>

async function signedIn(page: Page): Promise<void> {
  // Сервер чатов не нужен: сторы заполняет тест.
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
  // Копию открывает вход в мессенджер — он идёт сразу после входа в аккаунт.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const stores = (
            document.querySelector('#app') as unknown as {
              __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
            }
          ).__vue_app__.config.globalProperties.$pinia._s
          return stores.get('messenger-archive')?.ready === true
        }),
      { timeout: 30_000 }
    )
    .toBe(true)
}

/** Список чатов и переписка DM в сторах, мессенджер во весь экран. */
async function openFullMessenger(page: Page, messages: Record<string, unknown>[]): Promise<void> {
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
      chat.history[dm] = { reachedStart: false }
      ui.setDialogs(dialogs)
      await (stores.get('messenger') as { openMessenger: () => Promise<void> }).openMessenger()
      ui.isFullScreen = true
      ui.switchToChat(dm)
    },
    { dialogs: DIALOGS, dm: DM, messages }
  )
}

/** Элемент виден и сверху: в его центре не другое окно. */
async function onTop(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return false
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !!hit && (el === hit || el.contains(hit))
  }, selector)
}

async function archiveCall(page: Page, method: string, ...args: unknown[]): Promise<unknown> {
  return page.evaluate(
    async ({ method, args }) => {
      const stores = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const archive = stores.get('messenger-archive') as Record<
        string,
        (...a: unknown[]) => unknown
      >
      const result = await archive[method]!(...args)
      return JSON.parse(JSON.stringify(result ?? null))
    },
    { method, args }
  )
}

test('большой мессенджер: меню у сообщения поверх окна, удаление спрашивает поверх', async ({
  page,
}) => {
  await signedIn(page)
  await openFullMessenger(page, [
    { id: '$p1', senderId: mx(BOB), text: 'Привет от Боба', timestamp: NOW - 60_000 },
    { id: '$m1', senderId: 'me', text: 'Моё сообщение', timestamp: NOW - 30_000 },
  ])

  const mine = page.locator('[class*="mine"]').filter({ hasText: 'Моё сообщение' }).last()
  await expect(mine).toBeVisible({ timeout: 30_000 })
  await mine.hover()
  await mine.getByTestId('message-actions').click()

  const menu = page.locator('.message-actions-popover').filter({ visible: true })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Ответить' })).toBeVisible()
  expect(await onTop(page, '.message-actions-popover:not(.ant-popover-hidden) button')).toBe(true)

  await menu.getByRole('button', { name: 'Удалить' }).click()
  const confirm = page.locator('.ant-modal-confirm').filter({ hasText: 'Удалить сообщение?' })
  await expect(confirm).toContainText('Сообщение будет удалено у всех участников чата.')
  expect(await onTop(page, '.ant-modal-confirm .ant-btn-dangerous')).toBe(true)
  await confirm.getByRole('button', { name: 'Отмена' }).click()
  await expect(confirm).toBeHidden()
  await expect(page.getByText('Моё сообщение')).toBeVisible()
})

test('сохранённое, которого на сервере нет: значок и граница', async ({ page }) => {
  await signedIn(page)
  const base = { senderId: mx(BOB), archived: true, localOnly: true }
  await openFullMessenger(page, [
    { ...base, id: '$a1', text: 'Совсем старое', timestamp: NOW - 120 * DAY },
    { ...base, id: '$a2', text: 'Тоже старое', timestamp: NOW - 100 * DAY },
    { id: '$s1', senderId: mx(BOB), text: 'Свежее с сервера', timestamp: NOW - DAY },
  ])

  await expect(page.getByText('Свежее с сервера')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('local-only-mark')).toHaveCount(2)
  const divider = page.getByTestId('archive-divider')
  await expect(divider).toHaveCount(1)
  await expect(divider).toContainText('сервер уже удалил')
  // Граница — между сохранённым и тем, что пришло с сервера.
  const order = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-testid="archive-divider"], .message-text')]
    return nodes.map((n) =>
      n.matches('[data-testid="archive-divider"]') ? '|' : n.textContent?.trim()
    )
  })
  expect(order.indexOf('|')).toBe(order.findIndex((t) => t?.includes('Свежее')) - 1)
})

test('меню чата: «Сохранять на устройстве» — с подтверждением, только этот чат', async ({
  page,
}) => {
  await signedIn(page)
  await openFullMessenger(page, [])

  const row = page.getByTestId('chat-row').filter({ hasText: 'bob_ng' })
  await row.hover()
  await row.locator('.dots-btn').click()
  await page.getByTestId('archive-toggle').click()
  const confirm = page.locator('.ant-modal-confirm')
  await expect(confirm).toContainText('Сохранять «bob_ng» на этом устройстве?')
  await expect(confirm).toContainText('Остальные чаты сохраняться не начнут.')
  expect(await onTop(page, '.ant-modal-confirm .ant-btn-primary')).toBe(true)
  await confirm.getByRole('button', { name: 'Сохранять' }).click()

  await expect.poll(() => archiveCall(page, 'isArchived', DM)).toBe(true)
  expect(await archiveCall(page, 'isArchived', OTHER)).toBe(false)

  await row.hover()
  await row.locator('.dots-btn').click()
  await expect(page.getByTestId('archive-toggle')).toHaveText(/Не сохранять на устройстве/)
})

test('настройки «Чаты»: включить, выбрать режим, стереть копию с двумя вопросами', async ({
  page,
}) => {
  await signedIn(page)
  await openFullMessenger(page, [])
  await page.evaluate(async () => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: {
              $pinia: { _s: Stores }
              $router: { push: (to: string) => Promise<void> }
            }
          }
        }
      }
    ).__vue_app__.config.globalProperties
    ;(app.$pinia._s.get('messenger-ui') as Record<string, unknown>).isFullScreen = false
    await (app.$pinia._s.get('messenger') as { closeWidget: () => void }).closeWidget()
    await app.$router.push('/settings?tab=chats')
  })

  const enabled = page.getByTestId('archive-enabled')
  await expect(enabled).toBeVisible({ timeout: 30_000 })
  await expect(enabled).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByTestId('archive-total')).toHaveText('Пока ничего не сохранено')
  await enabled.click()
  await expect(enabled).toHaveAttribute('aria-checked', 'true')

  // Без сервера чатов список из стора держится не дольше первой перезагрузки
  // списка (её запускают профили) — сверяем по чату Боба, он открыт и остаётся.
  const rows = page.getByTestId('archive-chat')
  const bobRow = rows.filter({ hasText: 'bob_ng' })
  await expect(bobRow).toHaveCount(1)
  await expect(bobRow).toContainText('Сохраняется, пока пусто')

  // Что-то сохранилось: в списке — сколько и с какого дня.
  await archiveCall(page, 'save', DM, [
    {
      id: '$1',
      chatId: DM,
      senderId: mx(BOB),
      text: 'раз',
      timestamp: NOW - 3 * DAY,
      read: true,
      status: 'sent',
    },
    {
      id: '$2',
      chatId: DM,
      senderId: mx(BOB),
      text: 'два',
      timestamp: NOW - 2 * DAY,
      read: true,
      status: 'sent',
    },
    {
      id: '$3',
      chatId: DM,
      senderId: mx(BOB),
      text: 'три',
      timestamp: NOW - DAY,
      read: true,
      status: 'sent',
    },
  ])
  await expect(page.getByTestId('archive-total')).toHaveText('3 сообщения · чатов: 1')
  await expect(bobRow).toContainText('3 сообщения · с ')

  // «Выбранные»: сохраняется только отмеченное — Боба пока никто не отмечал.
  await page.getByTestId('archive-mode-selected').click()
  const bobSwitch = bobRow.getByTestId('archive-chat-switch')
  await expect(bobSwitch).toHaveAttribute('aria-checked', 'false')
  expect(await archiveCall(page, 'isArchived', DM)).toBe(false)
  await bobSwitch.click()
  await expect(bobSwitch).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => archiveCall(page, 'isArchived', DM)).toBe(true)

  // Стереть всё — два вопроса подряд.
  await page.getByTestId('archive-delete-all').click()
  const first = page.locator('.ant-modal-confirm').filter({ hasText: 'Удалить всю сохранённую' })
  await expect(first).toContainText('С устройства удалятся 3 сообщения из чатов: 1.')
  await first.getByRole('button', { name: 'Удалить', exact: true }).click()
  const second = page.locator('.ant-modal-confirm').filter({ hasText: 'Точно удалить всё?' })
  await expect(second).toContainText('после удаления их не вернуть', { ignoreCase: true })
  await second.getByRole('button', { name: 'Удалить навсегда' }).click()
  await expect(page.getByTestId('archive-total')).toHaveText('Пока ничего не сохранено')

  // Выбор помнится после перезагрузки.
  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await expect(page.getByTestId('archive-enabled')).toHaveAttribute('aria-checked', 'true', {
    timeout: 30_000,
  })
  await expect(page.getByTestId('archive-mode-selected')).toHaveAttribute('aria-checked', 'true')
})
