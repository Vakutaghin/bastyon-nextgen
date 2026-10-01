import { test, expect, type Browser, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Галочки «прочитано» вживую: два новых аккаунта переписываются через
 * настоящий Synapse. Блокчейн подменный (mock-node), Matrix — настоящий.
 * Это не тест для CI: без E2E_SYNAPSE_URL он пропускается. Запуск:
 *
 *   docker run -d --name bastyon-synapse-test -p 127.0.0.1:8008:8008 \
 *     -v <data>:/data matrixdotorg/synapse
 *   (data: `generate` с SYNAPSE_SERVER_NAME=matrix.pocketnet.app и
 *   enable_registration + enable_registration_without_verification)
 *   VITE_PORT=1981 MATRIX_PROXY_TARGET=http://127.0.0.1:8008 vite --strictPort --host 127.0.0.1
 *   E2E_SYNAPSE_URL=http://127.0.0.1:1981 playwright test matrix-receipts.live
 */

const BASE = process.env.E2E_SYNAPSE_URL
test.skip(!BASE, 'нужен локальный Synapse, см. шапку файла')
test.use({ baseURL: BASE })

interface Account {
  mnemonic: string
  address: string
  /** Открытые ключи мессенджера для профиля (`k`). */
  keys: string
}

/** Новые аккаунты — ключами самого приложения, как при регистрации. */
async function newAccounts(browser: Browser, count: number): Promise<Account[]> {
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

async function signedIn(browser: Browser, account: Account, data: MockNodeData): Promise<Page> {
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
async function openChatWith(page: Page, partner: Account, isNew: boolean): Promise<void> {
  await page.goto(`/${partner.address}`)
  await page.getByRole('button', { name: 'Начать чат' }).first().click()
  if (isNew) await page.getByRole('button', { name: 'Начать чат' }).nth(1).click()
  await expect(page.getByPlaceholder('Введите сообщение...')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Начать чат' })).toHaveCount(1)
}

/** Предупреждения страницы: кэш синка Matrix должен подниматься и после перезагрузки. */
function collectWarnings(page: Page): string[] {
  const warnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text())
  })
  return warnings
}

async function send(page: Page, text: string): Promise<void> {
  const input = page.getByPlaceholder('Введите сообщение...')
  await expect(input).toBeVisible({ timeout: 60_000 })
  await input.fill(text)
  await page.getByRole('button', { name: 'Отправить сообщение' }).click()
}

test('собеседник прочитал — у отправителя «✓✓», ответ читает отправитель — у собеседника тоже', async ({
  browser,
}) => {
  test.setTimeout(240_000)
  const [alice, bob] = await newAccounts(browser, 2)
  const data: MockNodeData = {
    profiles: [
      { address: alice!.address, name: 'alice_e2e', k: alice!.keys },
      { address: bob!.address, name: 'bob_e2e', k: bob!.keys },
    ],
    posts: [],
    comments: [],
  }
  const a = await signedIn(browser, alice!, data)
  const b = await signedIn(browser, bob!, data)
  const bobWarnings = collectWarnings(b)

  // Алиса пишет первой: комната создаётся, Боб приглашён.
  await openChatWith(a, bob!, true)
  await send(a, 'Привет, Боб')
  const aliceMark = a.getByTitle(/^(Прочитано|Отправлено, ещё не прочитано)$/).last()
  await expect(aliceMark).toHaveAttribute('title', 'Отправлено, ещё не прочитано', {
    timeout: 60_000,
  })
  await expect(aliceMark).toHaveText('✓')

  // Боб открывает чат сразу после перезагрузки страницы: приглашение
  // принимается, сообщение прочитано, кэш синка поднялся.
  await openChatWith(b, alice!, false)
  await expect(b.getByText('Привет, Боб')).toBeVisible({ timeout: 90_000 })
  await expect(aliceMark).toHaveAttribute('title', 'Прочитано', { timeout: 60_000 })
  await expect(aliceMark).toHaveText('✓✓')

  // Ответ: чат у Алисы открыт — она прочитала сразу.
  await send(b, 'Привет, Алиса')
  await expect(a.getByText('Привет, Алиса')).toBeVisible({ timeout: 60_000 })
  const bobMark = b.getByTitle(/^(Прочитано|Отправлено, ещё не прочитано)$/).last()
  await expect(bobMark).toHaveAttribute('title', 'Прочитано', { timeout: 60_000 })
  await expect(aliceMark).toHaveText('✓✓')

  // Мессенджер Боба закрыт — «прочитано» не уходит, пока он его не откроет.
  await b.getByRole('button', { name: 'Сообщения', exact: true }).click()
  await expect(b.getByPlaceholder('Введите сообщение...')).toBeHidden()
  await send(a, 'Ты тут?')
  const lastAliceMark = a.getByTitle(/^(Прочитано|Отправлено, ещё не прочитано)$/).last()
  await expect(lastAliceMark).toHaveAttribute('title', 'Отправлено, ещё не прочитано', {
    timeout: 30_000,
  })
  await a.waitForTimeout(5_000)
  await expect(lastAliceMark).toHaveText('✓')

  // Открылся список чатов: «Ты тут?» видно в превью, но чат не открыт — не прочитано.
  await b.getByRole('button', { name: 'Сообщения', exact: true }).click()
  await b.waitForTimeout(3_000)
  await expect(lastAliceMark).toHaveText('✓')
  await b.getByText('alice_e2e').last().click()
  await expect(b.getByPlaceholder('Введите сообщение...')).toBeVisible({ timeout: 30_000 })
  await expect(lastAliceMark).toHaveAttribute('title', 'Прочитано', { timeout: 60_000 })
  await expect(lastAliceMark).toHaveText('✓✓')
  expect(bobWarnings.filter((w) => w.includes('IndexedDBStore'))).toEqual([])
})
