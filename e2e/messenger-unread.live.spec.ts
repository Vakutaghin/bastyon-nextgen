import { test, expect, type Page } from '@playwright/test'
import { type MockNodeData } from './support/mock-node'
import {
  matrixId,
  matrixReady,
  newAccounts,
  openChatWith,
  send,
  signedIn,
  type Account,
} from './support/live-matrix'

/**
 * Счётчик чатов с непрочитанным вживую на своём Synapse: в шапке и на кнопке
 * внизу столько же, сколько строк с числом в списке, — по мере чтения, при
 * принятых приглашениях, после сбоя отметки «прочитано», перезапуска и нового
 * входа. Запуск — как у matrix-receipts.live.spec.ts.
 */

const BASE = process.env.E2E_SYNAPSE_URL
test.skip(!BASE, 'нужен локальный Synapse, см. шапку matrix-receipts.live.spec.ts')
test.use({ baseURL: BASE, actionTimeout: 30_000 })

const NAMES = ['alice_e2e', 'carolina_e2e', 'daniel_long_e2e']

async function store(page: Page, action: 'openMessenger' | 'relogin'): Promise<void> {
  await page.evaluate(async (what) => {
    type Messenger = {
      openMessenger: () => Promise<void>
      logout: () => void
      initMatrix: () => Promise<void>
    }
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Messenger> } } } }
      }
    ).__vue_app__
    const messenger = app.config.globalProperties.$pinia._s.get('messenger')!
    if (what === 'relogin') {
      messenger.logout()
      void messenger.initMatrix()
    }
    await messenger.openMessenger()
  }, action)
}

/** Число в шапке, на кнопке внизу справа и строк с числом в списке. */
async function counters(page: Page): Promise<{ header: number; button: number; rows: number }> {
  return page.evaluate(() => {
    const num = (el: Element | null | undefined) => Number(el?.textContent?.trim() || 0)
    const header = [...document.querySelectorAll('header [role="button"], header button')].find(
      (el) => /^Чаты/.test(el.getAttribute('aria-label') ?? '')
    )
    const button = document.querySelector('button[aria-label="Сообщения"]')
    const rows = [...document.querySelectorAll('[data-testid="chat-row"]')]
    return {
      header: num(header),
      button: num(button),
      rows: rows.filter((row) => row.querySelector('[data-testid="chat-unread"]')).length,
    }
  })
}

async function expectUnread(page: Page, n: number, timeout = 20_000): Promise<void> {
  await expect.poll(() => counters(page), { timeout }).toEqual({ header: n, button: n, rows: n })
}

const row = (page: Page, name: string) => page.getByTestId('chat-row').filter({ hasText: name })
const input = (page: Page) => page.getByPlaceholder('Введите сообщение...')

async function backToList(page: Page): Promise<void> {
  const messenger = page.getByRole('region', { name: 'Сообщения' })
  await messenger.getByRole('button', { name: 'Назад', exact: true }).first().click()
  await expect(page.getByTestId('chat-list-scroll')).toBeVisible()
}

/** Личное сообщение Бобу с аккаунта страницы: первое создаёт чат. */
async function writeTo(page: Page, bob: Account, text: string, isNew: boolean): Promise<void> {
  if (isNew) await openChatWith(page, bob, true)
  await send(page, text)
  await expect(page.getByText(text).last()).toBeVisible()
  await expect(page.getByTitle(/^(Прочитано|Отправлено, ещё не прочитано)$/).last()).toBeVisible({
    timeout: 60_000,
  })
}

test('число в шапке и на кнопке — как в списке: чтение, приглашения, сбой отметки, перезапуск', async ({
  browser,
}) => {
  test.setTimeout(480_000)
  const [bob, ...friends] = await newAccounts(browser, 4)
  const data: MockNodeData = {
    profiles: [
      { address: bob!.address, name: 'bob_e2e', k: bob!.keys },
      ...friends.map((f, i) => ({ address: f.address, name: NAMES[i]!, k: f.keys })),
    ],
    posts: [],
    comments: [],
  }
  const b = await signedIn(browser, bob!, data)
  await matrixReady(b)
  const pages: Page[] = []
  for (const friend of friends) {
    const page = await signedIn(browser, friend, data)
    await matrixReady(page)
    await writeTo(page, bob!, 'первое сообщение', true)
    pages.push(page)
  }

  // Три приглашения.
  await store(b, 'openMessenger')
  await expectUnread(b, 3)

  // Принимаем подряд, не задерживаясь в чате.
  for (const [i, name] of NAMES.entries()) {
    await row(b, name).click()
    await b.getByTestId('invite-accept').click()
    await expect(input(b)).toBeVisible({ timeout: 60_000 })
    await backToList(b)
    await expectUnread(b, 2 - i, 5_000)
  }

  // Новое в трёх чатах: читаем один за другим — число убывает сразу.
  for (const page of pages) await writeTo(page, bob!, 'второе сообщение', false)
  await expectUnread(b, 3)
  for (const [i, name] of NAMES.entries()) {
    await row(b, name).click()
    await expect(b.getByText('второе сообщение').last()).toBeVisible({ timeout: 30_000 })
    await backToList(b)
    await expectUnread(b, 2 - i, 2_000)
  }

  // Отметка «прочитано» не дошла: число всё равно убыло, а сервер узнаёт позже.
  await writeTo(pages[0]!, bob!, 'третье сообщение', false)
  await expectUnread(b, 1)
  let blocked = 0
  await b.route('**/read_markers', (route) => {
    blocked++
    return route.abort()
  })
  await row(b, NAMES[0]!).click()
  await expect(b.getByText('третье сообщение').last()).toBeVisible({ timeout: 30_000 })
  await backToList(b)
  await expect.poll(() => blocked).toBeGreaterThan(0)
  await expectUnread(b, 0, 2_000)
  await b.unroute('**/read_markers')
  const delivered = b.waitForResponse((r) => r.url().includes('/read_markers') && r.ok(), {
    timeout: 60_000,
  })
  // Любой ответ синка — связь есть.
  await writeTo(pages[1]!, bob!, 'третье сообщение', false)
  await delivered
  await expectUnread(b, 1)

  // Новый вход в тот же аккаунт (смена аккаунта туда и обратно) и сразу чтение.
  await writeTo(pages[2]!, bob!, 'третье сообщение', false)
  await expectUnread(b, 2)
  await store(b, 'relogin')
  await row(b, NAMES[1]!).click({ timeout: 60_000 })
  await expect(b.getByText('третье сообщение').last()).toBeVisible({ timeout: 60_000 })
  await backToList(b)
  await expectUnread(b, 1, 5_000)

  // Перезапуск: то же число.
  await b.reload()
  await b.waitForSelector('#app > *')
  await matrixReady(b)
  await store(b, 'openMessenger')
  await expectUnread(b, 1)
  // И держится: список за это время перечитывается не раз.
  await b.waitForTimeout(8_000)
  await expectUnread(b, 1, 1_000)

  // Ответили с другого устройства, не открывая чат здесь, — дочитан.
  const second = await signedIn(browser, bob!, data)
  await matrixReady(second)
  await second.evaluate(
    async ({ partner, mod }) => {
      const { matrixService } = await import(/* @vite-ignore */ mod)
      const client = matrixService.getClient()
      const room = client
        .getRooms()
        .find((r: { getMember: (id: string) => unknown }) => r.getMember(partner))
      await client.sendTextMessage(room.roomId, 'ответ с телефона')
    },
    {
      partner: matrixId(friends[2]!.address),
      mod: '/src/b-components/messenger/services/matrix-service.ts',
    }
  )
  await expectUnread(b, 0)
})
