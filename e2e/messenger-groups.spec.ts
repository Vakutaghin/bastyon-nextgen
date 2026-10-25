import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Группы в списке чатов, шапке и окне группы — без сервера чатов: диалоги
 * подставлены в стор, как список с прошлого запуска. Состав группы с сервером —
 * в messenger-groups.live.spec.ts.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const CAROL = 'PFGJoLTrDwDutGs2L4Bo6aZzFiq6BHHxrW'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`

const DATA: MockNodeData = {
  profiles: [
    { address: ALICE, name: 'alice_ng' },
    { address: BOB, name: 'bob_ng' },
    { address: CAROL, name: 'carolina_ng' },
  ],
  posts: [],
  comments: [],
}

const NOW = Date.now()
const DIALOGS = [
  {
    id: '!dm:matrix.pocketnet.app',
    partner: { id: mx(ALICE), name: 'alice_ng' },
    unreadCount: 1,
    lastMessage: {
      id: '$dm',
      chatId: '!dm:matrix.pocketnet.app',
      senderId: mx(ALICE),
      text: 'Привет лично',
      timestamp: NOW - 60_000,
      read: false,
      status: 'sent',
    },
  },
  {
    id: '!club:matrix.pocketnet.app',
    partner: { id: '!club:matrix.pocketnet.app', name: 'Книжный клуб' },
    unreadCount: 0,
    muted: true,
    hasUnread: true,
    group: {
      memberCount: 5,
      previewIds: [mx(ALICE), mx(BOB), mx(CAROL)],
      topic: 'Читаем по главе',
    },
    lastMessage: {
      id: '$club',
      chatId: '!club:matrix.pocketnet.app',
      senderId: mx(BOB),
      text: 'Третья глава',
      timestamp: NOW,
      read: false,
      status: 'sent',
    },
  },
]

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
  await page.evaluate(async (dialogs) => {
    type Store = Record<string, (...a: unknown[]) => unknown>
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
      }
    ).__vue_app__
    const stores = app.config.globalProperties.$pinia._s
    stores.get('messenger-ui')!.setDialogs!(dialogs)
    await stores.get('messenger')!.openMessenger!()
  }, DIALOGS)
}

/** Открыть чат без сервера: только выбрать его (загрузка истории ждала бы комнату). */
async function selectChat(page: Page, id: string): Promise<void> {
  await page.evaluate((chatId) => {
    type Store = Record<string, (...a: unknown[]) => unknown>
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
      }
    ).__vue_app__
    app.config.globalProperties.$pinia._s.get('messenger-ui')!.switchToChat!(chatId)
  }, id)
}

async function checkGroups(page: Page): Promise<void> {
  const rows = page.getByTestId('chat-row')
  const club = rows.and(page.locator('[data-group]'))
  const direct = page.locator('[data-testid=chat-row]:not([data-group])')

  // Группа узнаётся сразу: значок, мозаика из трёх участников, кто написал.
  await expect(club).toBeVisible({ timeout: 30_000 })
  await expect(club.getByLabel('Группа · 5 участников')).toBeVisible()
  await expect(club.getByRole('img', { name: 'Книжный клуб' })).toHaveClass(/\bn3\b/)
  await expect(club).toContainText('bob_ng: Третья глава', { timeout: 30_000 })
  // Без звука: колокольчик и точка вместо счётчика.
  await expect(club.getByLabel('Уведомления выключены')).toBeVisible()
  await expect(club.getByLabel('Есть новые сообщения')).toBeVisible()
  await expect(direct).toContainText('alice_ng')

  // Фильтр: «Все» или личные, группы и каналы в любом сочетании.
  const chip = (name: RegExp) =>
    page.getByRole('group', { name: 'Что показать в списке' }).getByRole('button', { name })
  await chip(/Группы/).click()
  await expect(club).toBeVisible()
  await expect(direct).toHaveCount(0)
  await chip(/Личные/).click()
  await expect(club).toBeVisible()
  await expect(direct).toHaveCount(1)
  await chip(/Группы/).click()
  await expect(club).toHaveCount(0)
  await expect(direct).toHaveCount(1)
  await expect(chip(/Группы/)).toHaveAttribute('aria-pressed', 'false')
  await expect(chip(/Личные/)).toHaveAttribute('aria-pressed', 'true')
  await chip(/^Все$/).click()
  await expect(rows).toHaveCount(2)
  // Каналов нет — подсказка, как их завести.
  await chip(/Каналы/).click()
  await expect(rows).toHaveCount(0)
  await expect(page.getByTestId('channels-empty')).toContainText('Читать в мессенджере')
  await chip(/^Все$/).click()

  // Шапка группы открывает окно группы.
  await selectChat(page, '!club:matrix.pocketnet.app')
  const title = page.getByRole('button', { name: 'Участники и настройки группы: Книжный клуб' })
  await expect(title).toBeVisible()
  await expect(title).toContainText('5 участников')
  await title.click()
  const modal = page.getByRole('dialog', { name: 'О группе' })
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('Группа · 5 участников')
  await expect(modal.getByText('Читаем по главе')).toBeVisible()
  await expect(modal.getByTestId('group-mute')).toContainText('Включить уведомления')
  // Комнаты на клиенте нет — состав появится после подключения.
  await expect(
    modal.getByText('Список участников появится, когда чат подключится к серверу.')
  ).toBeVisible()
  // Окно не шире экрана, страница не уезжает вбок.
  const box = await modal.locator('.ant-modal-content').boundingBox()
  const width = await page.evaluate(() => window.innerWidth)
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
}

test('группа в списке чатов, фильтр, шапка и окно группы', async ({ page }) => {
  test.setTimeout(90_000)
  await signedInWithDialogs(page)
  await checkGroups(page)
})

test.describe('на телефоне', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('то же в полноэкранном мессенджере', async ({ page }) => {
    test.setTimeout(90_000)
    await signedInWithDialogs(page)
    await checkGroups(page)
  })
})
