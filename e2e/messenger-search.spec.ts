import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Поиск в списке чатов: лупа раскрывает поле, свои чаты и группы находятся
 * сразу (не больше пяти), люди Bastyon — после паузы в наборе (не больше
 * пятнадцати), пока ищем — крутится значок. Диалоги подставлены в стор,
 * сервер чатов закрыт, поиск людей отвечает подменная нода.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`

/** 20 человек с «anna» в имени — в выдаче должно остаться 15. */
const PEOPLE = Array.from({ length: 20 }, (_, i) => ({
  address: `PAnna${String(i).padStart(2, '0')}xxxxxxxxxxxxxxxxxxxxxxxxx`,
  name: `anna_${i}`,
}))

const DATA: MockNodeData = {
  profiles: [{ address: BOB, name: 'bob_ng' }, ...PEOPLE],
  posts: [],
  comments: [],
}

const NOW = Date.now()
function dialog(id: string, name: string, minutesAgo: number, group = false) {
  return {
    id: `!${id}:matrix.pocketnet.app`,
    partner: { id: group ? `!${id}:matrix.pocketnet.app` : mx(BOB), name },
    unreadCount: 0,
    lastMessage: {
      id: `$${id}`,
      chatId: `!${id}:matrix.pocketnet.app`,
      senderId: mx(BOB),
      text: 'привет',
      timestamp: NOW - minutesAgo * 60_000,
      read: true,
      status: 'sent',
    },
    ...(group ? { group: { memberCount: 3, previewIds: [mx(BOB)] } } : {}),
  }
}

const DIALOGS = [
  dialog('boris', 'Борис', 1),
  dialog('anna', 'Anna Petrova', 2),
  dialog('analysts', 'Analysts', 3, true),
  ...Array.from({ length: 6 }, (_, i) => dialog(`announce${i}`, `Announce ${i}`, 4 + i, true)),
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

test('лупа: свои чаты сразу, люди из сети после паузы, Esc закрывает', async ({ page }) => {
  test.setTimeout(120_000)
  // Ответ сети придерживаем, чтобы увидеть значок загрузки.
  let release!: () => void
  const held = new Promise<void>((r) => (release = r))
  await page.route(/\/rpc\/searchusers/, async (route) => {
    await held
    await route.fallback()
  })
  await signedInWithDialogs(page)

  await page.getByTestId('chat-search-open').click()
  const input = page.getByTestId('chat-search-input')
  await expect(input).toBeFocused()

  await input.fill('an')
  const results = page.getByTestId('chat-search-results')
  // Свои — сразу и не больше пяти: Anna Petrova, Analysts и три Announce по свежести.
  await expect(results.getByTestId('chat-row')).toHaveText(
    [/Anna Petrova/, /Analysts/, /Announce 0/, /Announce 1/, /Announce 2/],
    { timeout: 10_000 }
  )
  await expect(results).not.toContainText('Борис')
  await expect(page.getByTestId('chat-search-loading')).toBeVisible()
  await expect(results).toContainText('Ищу…')

  release()
  await expect(results.getByTestId('chat-search-person')).toHaveCount(15, { timeout: 15_000 })
  await expect(page.getByTestId('chat-search-loading')).toBeHidden()
  await expect(results.getByTestId('chat-search-person').first()).toContainText('anna_0')

  // Ничего похожего: и в чатах, и в сети пусто.
  await input.fill('zzz')
  await expect(results).toContainText('Среди ваших чатов не нашлось')
  await expect(results).toContainText('Никого не нашлось', { timeout: 15_000 })

  // Одна буква — в сеть не ходим.
  await input.fill('b')
  await expect(results).toContainText('Введите хотя бы две буквы')

  // Esc — поле закрыто, на месте разделы и обычный список, окно мессенджера осталось.
  // Строки списка не считаем: без сервера чатов вход в мессенджер со временем
  // падает и список пустеет.
  await input.press('Escape')
  await expect(input).toBeHidden()
  await expect(results).toBeHidden()
  await expect(page.getByRole('group', { name: 'Что показать в списке' })).toBeVisible()
})

test('Enter открывает первый найденный чат, выбор человека закрывает поиск', async ({ page }) => {
  test.setTimeout(120_000)
  await signedInWithDialogs(page)

  await page.getByTestId('chat-search-open').click()
  const input = page.getByTestId('chat-search-input')
  await input.fill('anna p')
  await expect(page.getByTestId('chat-search-results').getByTestId('chat-row')).toHaveCount(1)
  await input.press('Enter')
  await expect(input).toBeHidden()
  const activeChat = () =>
    page.evaluate(() => {
      const app = (
        document.querySelector('#app') as unknown as {
          __vue_app__: {
            config: {
              globalProperties: { $pinia: { _s: Map<string, { activeChatId?: string | null }> } }
            }
          }
        }
      ).__vue_app__
      return app.config.globalProperties.$pinia._s.get('messenger-ui')!.activeChatId ?? null
    })
  await expect.poll(activeChat).toBe('!anna:matrix.pocketnet.app')

  // Назад к списку — и человек из сети: поиск закрывается, начинается переписка с ним.
  await page.evaluate(() => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: {
              $pinia: { _s: Map<string, { setActiveChatId: (id: string | null) => void }> }
            }
          }
        }
      }
    ).__vue_app__
    app.config.globalProperties.$pinia._s.get('messenger-ui')!.setActiveChatId(null)
  })
  await page.getByTestId('chat-search-open').click()
  await input.fill('anna_1')
  const person = page.getByTestId('chat-search-person').filter({ hasText: 'anna_10' })
  await person.click({ timeout: 15_000 })
  await expect(input).toBeHidden()
})
