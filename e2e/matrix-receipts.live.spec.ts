import { test, expect, type Page } from '@playwright/test'
import { type MockNodeData } from './support/mock-node'
import { newAccounts, openChatWith, send, signedIn } from './support/live-matrix'

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

/** Предупреждения страницы: кэш синка Matrix должен подниматься и после перезагрузки. */
function collectWarnings(page: Page): string[] {
  const warnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text())
  })
  return warnings
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
