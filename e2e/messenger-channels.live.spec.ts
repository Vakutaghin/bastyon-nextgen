import { test, expect, type Page } from '@playwright/test'
import { type MockNodeData } from './support/mock-node'
import { matrixReady, newAccounts, signedIn } from './support/live-matrix'

/**
 * Каналы на двух устройствах одного аккаунта: список каналов и место, до
 * которого прочитано, лежат в данных аккаунта на сервере чатов. Запуск — как у
 * matrix-receipts.live.spec.ts; без E2E_SYNAPSE_URL пропускается.
 */

const BASE = process.env.E2E_SYNAPSE_URL
test.skip(!BASE, 'нужен локальный Synapse, см. шапку matrix-receipts.live.spec.ts')
test.use({ baseURL: BASE })

const AUTHOR = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'

type Pinia = { _s: Map<string, Record<string, unknown>> }

/** Каналы страницы: включённые и сколько новых у автора. */
async function channelsOf(page: Page): Promise<{ on: string[]; fresh: number }> {
  return page.evaluate((address) => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: Pinia } } }
      }
    ).__vue_app__
    const store = app.config.globalProperties.$pinia._s.get('messenger-channels') as {
      addresses: string[]
      newCount: (a: string) => number
    }
    return { on: [...store.addresses], fresh: store.newCount(address) }
  }, AUTHOR)
}

async function refreshChannels(page: Page): Promise<void> {
  await page.evaluate(async (address) => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: Pinia } } }
      }
    ).__vue_app__
    const store = app.config.globalProperties.$pinia._s.get('messenger-channels') as {
      refresh: (list: string[], opts: { force: boolean }) => Promise<void>
    }
    await store.refresh([address], { force: true })
  }, AUTHOR)
}

/** Переход внутри приложения: перезагрузка страницы заново входила бы в Matrix. */
async function goTo(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $router: { push: (p: string) => Promise<void> } } }
        }
      }
    ).__vue_app__
    await app.config.globalProperties.$router.push(to)
  }, path)
}

async function openMessenger(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: Pinia } } }
      }
    ).__vue_app__
    const store = app.config.globalProperties.$pinia._s.get('messenger') as {
      openMessenger: () => Promise<void>
    }
    await store.openMessenger()
  })
}

test('канал с одного устройства появляется на другом, прочитанное и отключение — тоже', async ({
  browser,
}) => {
  test.setTimeout(300_000)
  const [me] = await newAccounts(browser, 1)
  const data: MockNodeData = {
    profiles: [
      { address: me!.address, name: 'reader_e2e', k: me!.keys },
      { address: AUTHOR, name: 'author_e2e' },
    ],
    posts: [
      { txid: 'a'.repeat(64), address: AUTHOR, message: 'Пост автора', ago: 3600 },
      { txid: 'b'.repeat(64), address: AUTHOR, message: 'Ещё пост автора', ago: 600 },
    ],
    comments: [],
  }
  const phone = await signedIn(browser, me!, data)
  const desktop = await signedIn(browser, me!, data)
  await Promise.all([matrixReady(phone), matrixReady(desktop)])

  // На «телефоне» — «Читать в мессенджере» в профиле автора.
  await goTo(phone, `/${AUTHOR}`)
  const read = phone.getByTestId('profile-channel').filter({ visible: true })
  await expect(read).toHaveText('Читать в мессенджере', { timeout: 30_000 })
  await read.click()
  await expect(read).toHaveText('Открыть в мессенджере')

  // На «компьютере» канал появляется сам — через сервер чатов.
  await expect
    .poll(async () => (await channelsOf(desktop)).on, { timeout: 60_000 })
    .toEqual([AUTHOR])
  await openMessenger(desktop)
  const row = desktop.locator('[data-testid=chat-row][data-channel]')
  await expect(row).toContainText('author_e2e', { timeout: 30_000 })
  await expect(row).toContainText('Ещё пост автора')

  // Автор опубликовал новое — новое на обоих устройствах.
  data.posts.push({ txid: 'c'.repeat(64), address: AUTHOR, message: 'Совсем новый', ago: -300 })
  await Promise.all([refreshChannels(phone), refreshChannels(desktop)])
  expect((await channelsOf(phone)).fresh).toBe(1)
  await expect(row.getByLabel('1 новая публикация')).toBeVisible()

  // Прочитали на «компьютере» — прочитано и на «телефоне».
  await row.click()
  await expect(desktop.getByTestId('channel-post').last()).toContainText('Совсем новый', {
    timeout: 30_000,
  })
  await expect.poll(async () => (await channelsOf(phone)).fresh, { timeout: 60_000 }).toBe(0)

  // Отключили на «телефоне» — канал уходит и с «компьютера».
  await phone.getByTestId('profile-channel-stop').filter({ visible: true }).click()
  await expect.poll(async () => (await channelsOf(desktop)).on, { timeout: 60_000 }).toEqual([])
  await desktop.keyboard.press('Escape')
  await expect(row).toHaveCount(0)
})
