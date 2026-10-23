import { expect, type Browser, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './mock-node'

// Живые тесты мессенджера на своём Synapse (см. шапку matrix-receipts.live.spec.ts):
// новые аккаунты, вход, личный чат, отправка, matrix-клиент страницы.

const BASE = process.env.E2E_SYNAPSE_URL

export interface Account {
  mnemonic: string
  address: string
  /** Открытые ключи мессенджера для профиля (`k`). */
  keys: string
}

/** Новые аккаунты — ключами самого приложения, как при регистрации. */
export async function newAccounts(browser: Browser, count: number): Promise<Account[]> {
  const page = await browser.newPage({ baseURL: BASE })
  await page.goto('/')
  const accounts = await page.evaluate(async (n) => {
    const keyGen = await import('/src/blockchain/core/keys/key-generator.ts')
    const addresses = await import('/src/blockchain/core/addresses/address-generator.ts')
    return Array.from({ length: n }, () => {
      const mnemonic = String(keyGen.generateMnemonic())
      const keyPair = keyGen.generateKeyPairFromMnemonic(mnemonic)
      return {
        mnemonic,
        address: addresses.generatePocketnetAddress(keyPair.publicKey).address,
        keys: keyGen
          .deriveMessengerKeys(keyPair.privateKey)
          .map((k: { public: string }) => k.public)
          .join(','),
      }
    })
  }, count)
  await page.close()
  return accounts
}

export async function signedIn(
  browser: Browser,
  account: Account,
  data: MockNodeData
): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE, locale: 'ru-RU' })
  const page = await context.newPage()
  await useMockNode(page, data)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(account.mnemonic)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
  return page
}

/**
 * Открыть личный чат из профиля собеседника. Новый чат начинается кнопкой на
 * карточке собеседника; существующий открывается сразу — и сразу после
 * запуска, пока не пришёл первый синк.
 */
export async function openChatWith(page: Page, partner: Account, isNew: boolean): Promise<void> {
  await page.goto(`/${partner.address}`)
  await page.getByRole('button', { name: 'Начать чат' }).first().click()
  if (isNew) await page.getByRole('button', { name: 'Начать чат' }).nth(1).click()
  await expect(page.getByPlaceholder('Введите сообщение...')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Начать чат' })).toHaveCount(1)
}

export async function send(page: Page, text: string): Promise<void> {
  const input = page.getByPlaceholder('Введите сообщение...')
  await expect(input).toBeVisible({ timeout: 60_000 })
  await input.fill(text)
  await page.getByRole('button', { name: 'Отправить сообщение' }).click()
}

/** Matrix-id аккаунта на тестовом Synapse (server_name как у прода). */
export function matrixId(address: string): string {
  return `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
}

/** Ждёт первый синк matrix-клиента страницы. */
export async function matrixReady(page: Page): Promise<void> {
  const state = () =>
    page.evaluate(async () => {
      const { matrixService } =
        await import('/src/b-components/messenger/services/matrix-service.ts')
      const app = (
        document.querySelector('#app') as unknown as {
          __vue_app__: {
            config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
          }
        }
      ).__vue_app__
      const ui = app.config.globalProperties.$pinia._s.get('messenger-ui')
      return {
        synced: !!matrixService.getClient()?.isInitialSyncComplete?.(),
        syncState: ui?.syncState,
        syncError: ui?.syncError,
      }
    })
  try {
    await expect.poll(async () => (await state()).synced, { timeout: 120_000 }).toBe(true)
  } catch (e) {
    console.warn('matrix not ready:', JSON.stringify(await state()))
    throw e
  }
}
