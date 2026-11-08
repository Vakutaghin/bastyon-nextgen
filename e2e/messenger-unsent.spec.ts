import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Неотправленное без сервера чатов (он недоступен — отправка не удаётся):
 * голосовое, пока уходит и когда не ушло, видно в строке списка чатов;
 * «Повторить» отправляет снова; не ушедшее переживает перезапуск, а
 * удалённое — нет. Повтор, который доходит до сервера, — в unit-тестах.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
const DM = '!dm:matrix.pocketnet.app'

const DATA: MockNodeData = {
  profiles: [{ address: ALICE, name: 'alice_ng' }],
  posts: [],
  comments: [],
}

type Stores = Map<string, Record<string, (...args: unknown[]) => unknown>>

/** Вход в мессенджер кончился (без сервера чатов — неудачей): список он больше не перепишет. */
async function loginSettled(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const app = (
            document.querySelector('#app') as unknown as {
              __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
            }
          ).__vue_app__
          const ui = app.config.globalProperties.$pinia._s.get('messenger-ui') as unknown as {
            isInitInProgress: boolean
            syncState: string
          }
          return !ui.isInitInProgress && ui.syncState === 'ERROR'
        }),
      { timeout: 60_000 }
    )
    .toBe(true)
}

/** Сохранённый список чатов: без сервера чатов он не придёт синком. */
async function openMessenger(page: Page): Promise<void> {
  await loginSettled(page)
  await page.evaluate(
    async ({ dm, alice }) => {
      const app = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__
      const stores = app.config.globalProperties.$pinia._s
      stores.get('messenger-ui')!.setDialogs!([
        {
          id: dm,
          partner: { id: alice, name: 'alice_ng' },
          unreadCount: 0,
          lastMessage: {
            id: '$hello',
            chatId: dm,
            senderId: alice,
            text: 'Привет лично',
            timestamp: Date.now() - 60_000,
            read: true,
            status: 'sent',
          },
        },
      ])
      await stores.get('messenger')!.openMessenger!()
    },
    { dm: DM, alice: mx(ALICE) }
  )
}

async function chat(page: Page, chatId: string | null): Promise<void> {
  await page.evaluate((id) => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
      }
    ).__vue_app__
    const stores = app.config.globalProperties.$pinia._s
    if (id) stores.get('messenger-ui')!.switchToChat!(id)
    else (stores.get('messenger') as unknown as { activeChatId: string | null }).activeChatId = null
  }, chatId)
}

/** Голосовое (две секунды WAV) или текст — через стор, как отправляет поле ввода. */
async function sendViaStore(page: Page, what: 'voice' | 'text'): Promise<void> {
  await page.evaluate(
    ({ dm, kind }) => {
      const app = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__
      const chatStore = app.config.globalProperties.$pinia._s.get('messenger-chat')!
      if (kind === 'text') {
        void chatStore.sendMessage!(dm, 'Это не уйдёт')
        return
      }
      const rate = 8000
      const n = rate * 2
      const buf = new ArrayBuffer(44 + n * 2)
      const v = new DataView(buf)
      const tag = (at: number, s: string) =>
        [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)))
      tag(0, 'RIFF')
      v.setUint32(4, 36 + n * 2, true)
      tag(8, 'WAVE')
      tag(12, 'fmt ')
      v.setUint32(16, 16, true)
      v.setUint16(20, 1, true)
      v.setUint16(22, 1, true)
      v.setUint32(24, rate, true)
      v.setUint32(28, rate * 2, true)
      v.setUint16(32, 2, true)
      v.setUint16(34, 16, true)
      tag(36, 'data')
      v.setUint32(40, n * 2, true)
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 10) * 8000, true)
      void chatStore.sendAudio!(dm, new Blob([buf], { type: 'audio/wav' }), { duration: 2 })
    },
    { dm: DM, kind: what }
  )
}

/** Своё сообщение в ленте, которое ещё уходит, — как его видит строка списка. */
async function pendingVoice(page: Page, on: boolean): Promise<void> {
  await page.evaluate(
    ({ dm, add }) => {
      const app = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__
      const chatStore = app.config.globalProperties.$pinia._s.get('messenger-chat') as unknown as {
        messages: Record<string, unknown[]>
        currentUser: { id: string }
      }
      const list = chatStore.messages[dm] ?? (chatStore.messages[dm] = [])
      if (!add) {
        chatStore.messages[dm] = list.filter((m) => (m as { id: string }).id !== 'local-probe')
        return
      }
      list.push({
        id: 'local-probe',
        chatId: dm,
        senderId: chatStore.currentUser.id,
        text: '',
        type: 'audio',
        info: { uploadProgress: 30 },
        timestamp: Date.now(),
        read: true,
        status: 'sending',
      })
    },
    { dm: DM, add: on }
  )
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

/** Перезапуск: вход восстанавливается сам; окно открываем, когда он прошёл (вход сбрасывает окно). */
async function restart(page: Page): Promise<void> {
  await page.reload()
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await expect(page.locator('[data-header-avatar]')).toBeVisible({ timeout: 30_000 })
  await openMessenger(page)
  await expect(page.getByTestId('chat-row').filter({ hasText: 'alice_ng' })).toBeVisible({
    timeout: 30_000,
  })
}

test('не ушедшее: видно в списке, повтор, удаление, после перезапуска — на месте', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  let sendErrors = 0
  page.on('console', (m) => {
    if (m.text().includes('Ошибка отправки вложения')) sendErrors += 1
  })
  await signIn(page)
  await openMessenger(page)
  const row = page.getByTestId('chat-row').filter({ hasText: 'alice_ng' })
  await expect(row).toContainText('Привет лично', { timeout: 30_000 })

  // Голосовое уходит — в строке оно, с «…», а не прошлое сообщение.
  await pendingVoice(page, true)
  await expect(row).toContainText('Аудио сообщение')
  await expect(row.getByTestId('last-mark')).toHaveAttribute('data-mark', '…')
  await pendingVoice(page, false)
  await expect(row).toContainText('Привет лично')

  // Текст и голосовое не уходят: сервера чатов нет. В строке — последнее, с «!».
  await sendViaStore(page, 'text')
  await sendViaStore(page, 'voice')
  await expect(row).toContainText('Аудио сообщение')
  await expect(row.getByTestId('last-mark')).toHaveText('!', { timeout: 60_000 })

  await chat(page, DM)
  await expect(page.getByText('Не отправлено')).toHaveCount(2, { timeout: 60_000 })
  // Запись на устройстве слушается — кнопка не крутится.
  const voice = page.getByTestId('audio-message')
  await expect(voice.locator('button').first()).toBeEnabled()

  // «Повторить» у голосового — отправляет снова (и снова не уходит).
  const before = sendErrors
  await page.getByTestId('retry-send').last().click()
  await expect.poll(() => sendErrors).toBe(before + 1)
  await expect(page.getByText('Не отправлено')).toHaveCount(2)

  // Перезапуск: оба не ушедших на месте, с повтором.
  await restart(page)
  await chat(page, DM)
  await expect(page.getByText('Не отправлено')).toHaveCount(2, { timeout: 60_000 })
  await expect(page.getByText('Это не уйдёт')).toBeVisible()
  await expect(page.getByTestId('retry-send').last()).toBeVisible()
  await expect(page.getByTestId('audio-message')).toHaveCount(1)

  // Текст удалили — после перезапуска его нет, голосовое осталось.
  await page.getByTestId('discard-unsent').first().click()
  await page
    .locator('.ant-modal-confirm')
    .getByRole('button', { name: 'Удалить', exact: true })
    .click()
  await expect(page.getByText('Это не уйдёт')).toHaveCount(0)
  await restart(page)
  await chat(page, DM)
  await expect(page.getByTestId('audio-message')).toHaveCount(1, { timeout: 60_000 })
  await expect(page.getByText('Не отправлено')).toHaveCount(1)
  await expect(page.getByText('Это не уйдёт')).toHaveCount(0)
})
