import { test, expect, type Page, type Route } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Синк с сервером чатов не идёт: баннер говорит почему и даёт «Повторить»,
 * а отвергнутый сервером токен ведёт к новому входу, а не к вечной ошибке.
 * Сервер чатов подменён целиком — тест не ходит ни в какую сеть.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const DATA: MockNodeData = {
  profiles: [{ address: ALICE, name: 'alice_ng' }],
  posts: [],
  comments: [],
}

interface FakeMatrix {
  logins: number
  /** Что отвечать на правила уведомлений. */
  pushrules: 'ok' | 'fail'
  /** Токен, который сервер «забыл»: синк с ним — M_UNKNOWN_TOKEN. */
  revoked: string | null
}

async function fakeMatrix(page: Page): Promise<FakeMatrix> {
  const state: FakeMatrix = { logins: 0, pushrules: 'ok', revoked: null }
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route('**/_matrix/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (path.endsWith('/versions')) return json(route, 200, { versions: ['v1.11'] })
    if (path.endsWith('/login')) {
      state.logins++
      return json(route, 200, {
        access_token: `token-${state.logins}`,
        user_id: '@e2e:matrix.pocketnet.app',
        device_id: `DEV${state.logins}`,
      })
    }
    if (path.includes('/pushrules')) {
      return state.pushrules === 'ok'
        ? json(route, 200, { global: {} })
        : json(route, 502, { errcode: 'M_UNKNOWN', error: 'Bad gateway' })
    }
    if (path.endsWith('/filter')) return json(route, 200, { filter_id: '1' })
    if (path.endsWith('/sync')) {
      const auth = route.request().headers()['authorization'] ?? ''
      if (state.revoked && auth === `Bearer ${state.revoked}`) {
        return json(route, 401, { errcode: 'M_UNKNOWN_TOKEN', error: 'Unknown token' })
      }
      // Длинный опрос: следующий синк отвечаем не сразу.
      if (url.searchParams.get('since')) await new Promise((r) => setTimeout(r, 2000))
      return json(route, 200, {
        next_batch: `s${Date.now()}`,
        rooms: { join: {}, invite: {}, leave: {} },
        account_data: { events: [] },
        presence: { events: [] },
      })
    }
    return json(route, 200, {})
  })
  return state
}

async function signIn(page: Page): Promise<void> {
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
}

async function openMessenger(page: Page): Promise<void> {
  await page.evaluate(async () => {
    type Store = { openMessenger: () => Promise<void> }
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
      }
    ).__vue_app__
    await app.config.globalProperties.$pinia._s.get('messenger')!.openMessenger()
  })
}

test('сервер отвечает ошибкой — баннер говорит почему, «Повторить» поднимает синк', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const matrix = await fakeMatrix(page)
  matrix.pushrules = 'fail'
  await signIn(page)
  await openMessenger(page)

  const banner = page.getByTestId('sync-error')
  await expect(banner).toContainText('Ошибка синхронизации: сервер чатов ответил ошибкой 502', {
    timeout: 60_000,
  })
  await expect(banner).toContainText('HTTP 502 M_UNKNOWN')

  matrix.pushrules = 'ok'
  await banner.getByRole('button', { name: 'Повторить' }).click()
  await expect(banner).toBeHidden({ timeout: 30_000 })
  await expect(page.getByText('Загрузка диалогов')).toHaveCount(0, { timeout: 30_000 })
})

test('сервер отверг токен — мессенджер входит заново и синк идёт', async ({ page }) => {
  test.setTimeout(120_000)
  const matrix = await fakeMatrix(page)
  // Токен первого входа сервер не признаёт — как сессия, отозванная на сервере.
  matrix.revoked = 'token-1'
  await signIn(page)
  await openMessenger(page)

  await expect.poll(() => matrix.logins, { timeout: 60_000 }).toBe(2)
  await expect(page.getByTestId('sync-error')).toBeHidden({ timeout: 60_000 })
  await expect(page.getByText('Загрузка диалогов')).toHaveCount(0, { timeout: 30_000 })
})
