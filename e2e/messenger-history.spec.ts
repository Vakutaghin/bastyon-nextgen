import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Почему в чате нет сообщений: приглашение видно в списке, удалённое — отметкой
 * «кто удалил», у пустого чата — кто и когда его создал и стёр ли сервер
 * переписку, у сбоя — ошибка и «Повторить». Новый чат создаётся только первым
 * сообщением. Без сервера чатов: состояние подставлено в сторы.
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
const DM = '!dm:matrix.pocketnet.app'
const EMPTY = '!empty:matrix.pocketnet.app'
const BROKEN = '!broken:matrix.pocketnet.app'

const DIALOGS = [
  {
    id: '!invite:matrix.pocketnet.app',
    partner: { id: mx(ALICE), name: 'alice_ng' },
    unreadCount: 0,
    hasUnread: true,
    createdAt: NOW - 120_000,
    invite: { by: mx(ALICE) },
  },
  {
    id: '!group-invite:matrix.pocketnet.app',
    partner: { id: '!group-invite:matrix.pocketnet.app', name: 'Книжный клуб' },
    unreadCount: 0,
    createdAt: NOW - 180_000,
    group: { memberCount: 4, previewIds: [mx(BOB)] },
    invite: { by: mx(BOB) },
  },
  {
    id: DM,
    partner: { id: mx(BOB), name: 'bob_ng' },
    unreadCount: 0,
    lastMessage: {
      id: '$last',
      chatId: DM,
      senderId: mx(BOB),
      text: '',
      timestamp: NOW - 60_000,
      read: true,
      status: 'sent',
      deleted: { by: mx(BOB), at: NOW - 30_000 },
    },
  },
  { id: EMPTY, partner: { id: mx(ALICE), name: 'alice_ng' }, unreadCount: 0 },
  { id: BROKEN, partner: { id: mx(BOB), name: 'bob_ng' }, unreadCount: 0 },
]

type Store = Record<string, unknown>

async function signedInWithDialogs(page: Page): Promise<void> {
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
  await page.evaluate(
    async ({ dialogs, dm, empty, broken, bob, now }) => {
      const stores = (
        document.querySelector('#app') as unknown as {
          __vue_app__: {
            config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
          }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const ui = stores.get('messenger-ui') as Record<string, (...a: unknown[]) => unknown>
      const chat = stores.get('messenger-chat') as {
        messages: Record<string, unknown[]>
        history: Record<string, unknown>
        currentUser: { id: string }
      }
      const me = chat.currentUser.id
      const base = { chatId: dm, read: true, status: 'sent' }
      chat.messages[dm] = [
        { ...base, id: '$1', senderId: bob, text: 'Привет', timestamp: now - 600_000 },
        {
          ...base,
          id: '$2',
          senderId: me,
          text: '',
          timestamp: now - 500_000,
          deleted: { by: me, at: now - 400_000 },
        },
        {
          ...base,
          id: '$3',
          senderId: me,
          text: '',
          timestamp: now - 450_000,
          deleted: { by: me, at: now - 300_000 },
        },
        {
          ...base,
          id: '$4',
          senderId: bob,
          text: '*** Encrypted Message ***',
          timestamp: now - 200_000,
        },
        {
          ...base,
          id: '$last',
          senderId: bob,
          text: '',
          timestamp: now - 60_000,
          deleted: { by: bob, at: now - 30_000 },
        },
      ]
      chat.history[dm] = { reachedStart: true, createdBy: bob, createdAt: now - 86_400_000 * 40 }
      chat.messages[empty] = []
      chat.history[empty] = {
        reachedStart: true,
        createdBy: me,
        createdAt: Date.UTC(2026, 8, 1, 12),
        purged: true,
        purgedBefore: Date.UTC(2026, 9, 1, 12),
        retentionMs: 30 * 86_400_000,
      }
      chat.messages[broken] = []
      chat.history[broken] = { reachedStart: false, error: 'HTTP 502' }
      ui.setDialogs!(dialogs)
      await (stores.get('messenger') as Record<string, () => Promise<void>>).openMessenger!()
    },
    { dialogs: DIALOGS, dm: DM, empty: EMPTY, broken: BROKEN, bob: mx(BOB), now: NOW }
  )
}

/** Открыть чат без сервера: только выбрать его (загрузка истории ждала бы комнату). */
async function selectChat(page: Page, id: string): Promise<void> {
  await page.evaluate((chatId) => {
    const stores = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $pinia: { _s: Map<string, Store> } } }
        }
      }
    ).__vue_app__.config.globalProperties.$pinia._s
    ;(stores.get('messenger-ui') as Record<string, (id: string) => void>).switchToChat!(chatId)
  }, id)
}

test('приглашения и удалённое в списке чатов', async ({ page }) => {
  await signedInWithDialogs(page)
  const row = (name: string) => page.getByTestId('chat-row').filter({ hasText: name })

  await expect(row('alice_ng').first()).toContainText('Приглашение в чат', { timeout: 30_000 })
  await expect(row('Книжный клуб')).toContainText('bob_ng: приглашение в группу')
  await expect(row('Сообщение удалено')).toContainText('bob_ng')
})

test('в переписке: кто удалил, нерасшифрованное, начало чата', async ({ page }) => {
  await signedInWithDialogs(page)
  await selectChat(page, DM)

  const marks = page.getByTestId('deleted-mark')
  await expect(marks).toHaveCount(2, { timeout: 30_000 })
  await expect(marks.first()).toContainText('Вы удалили 2 сообщения')
  await expect(marks.last()).toContainText('bob_ng удалил(а) сообщение')
  await expect(page.getByTestId('undecryptable')).toContainText('Не удалось расшифровать сообщение')
  await expect(page.getByText('*** Encrypted Message ***')).toHaveCount(0)
  await expect(page.getByTestId('chat-history-note')).toContainText('bob_ng создал(а) чат')
})

test('пустой чат объясняет себя, сбой загрузки — с «Повторить»', async ({ page }) => {
  await signedInWithDialogs(page)
  await selectChat(page, EMPTY)
  const note = page.getByTestId('chat-history-note')
  await expect(note).toContainText('Вы создали чат · 1 сентября 2026', { timeout: 30_000 })
  await expect(note).toContainText('Сообщения до 1 октября 2026 г. удалены с сервера.')
  await expect(note).toContainText('Сервер хранит сообщения этого чата 30 дней.')
  await expect(note).toContainText('Сообщений в этом чате нет.')

  await selectChat(page, BROKEN)
  await expect(note).toContainText('Не удалось загрузить историю переписки.')
  await expect(note).toContainText('HTTP 502')
  await expect(note.getByRole('button', { name: 'Повторить' })).toBeVisible()
})

test('новый чат: сразу поле ввода, комната — только с первым сообщением', async ({ page }) => {
  await signedInWithDialogs(page)
  await page.evaluate((address) => {
    const stores = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $pinia: { _s: Map<string, Store> } } }
        }
      }
    ).__vue_app__.config.globalProperties.$pinia._s
    ;(stores.get('messenger-ui') as Record<string, (a: string) => void>).showInvite!(address)
  }, ALICE)

  await expect(
    page.getByText('Напишите первое сообщение — alice_ng увидит чат, когда оно уйдёт.')
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Начать чат' })).toHaveCount(0)
  await expect(page.getByLabel('Записать голосовое сообщение')).toHaveCount(0)

  // У Алисы нет ключей мессенджера: комната не создаётся, текст остаётся в поле.
  const createRoom = page.waitForRequest(/createRoom/, { timeout: 3_000 }).catch(() => null)
  const input = page.getByPlaceholder('Введите сообщение...')
  await input.fill('Привет, Алиса')
  await page.getByRole('button', { name: 'Отправить сообщение' }).click()
  await expect(page.getByText(/не опубликовал ключи шифрования/)).toBeVisible()
  await expect(input).toHaveValue('Привет, Алиса')
  expect(await createRoom).toBeNull()
})
