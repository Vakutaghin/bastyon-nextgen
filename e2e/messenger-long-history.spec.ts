import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Длинная переписка открывается быстро: рисуются последние 30 сообщений, а не
 * все полтораста разом (иначе на телефоне поле ввода не отвечало, пока
 * рисовалась лента). Старые дорисовываются при прокрутке к началу, и то, что
 * было на экране, остаётся на месте. Сервера чатов нет: переписка подставлена
 * в стор, вход в Matrix оборван.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
const DATA: MockNodeData = { profiles: [{ address: BOB, name: 'bob_ng' }], posts: [], comments: [] }
const DM = '!dm:matrix.pocketnet.app'
const TOTAL = 150

async function openLongChat(page: Page): Promise<void> {
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

  await page.evaluate(
    async ({ dm, bob, total }) => {
      const s = (
        document.querySelector('#app') as unknown as {
          __vue_app__: {
            config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
          }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const ui = s.get('messenger-ui') as Record<string, unknown> & {
        setDialogs: (d: unknown[]) => void
        switchToChat: (id: string) => void
      }
      ui.setDialogs([{ id: dm, partner: { id: bob, name: 'bob_ng' }, unreadCount: 0 }])
      await (s.get('messenger') as { openMessenger: () => Promise<void> }).openMessenger()
      const now = Date.now()
      ;(s.get('messenger-chat') as { messages: Record<string, unknown[]> }).messages[dm] =
        Array.from({ length: total }, (_, i) => ({
          id: `$m${i}`,
          chatId: dm,
          senderId: i % 3 === 0 ? bob : '@me:matrix.pocketnet.app',
          text: `Сообщение ${String(i + 1).padStart(3, '0')}`,
          timestamp: now - (total - i) * 60_000,
          read: true,
          status: 'sent',
        }))
      ui.switchToChat(dm)
    },
    { dm: DM, bob: mx(BOB), total: TOTAL }
  )
}

const rendered = (page: Page) => page.getByTestId('message-list').locator('.message-text')

test('длинная переписка: рисуются последние, старые — при прокрутке, экран не прыгает', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openLongChat(page)
  const list = page.getByTestId('message-list')
  await expect(list.getByText('Сообщение 150')).toBeVisible({ timeout: 30_000 })
  await expect(rendered(page)).toHaveCount(30)

  // Листаем к началу: дорисовываются следующие 40, верхнее остаётся на месте.
  // Место — по раскладке (offsetTop минус прокрутка): окно мессенджера ещё
  // может раскрываться (transform: scale), и экранные координаты плывут.
  const placeOf = (text: string) =>
    list.evaluate((el, t) => {
      const row = [...el.querySelectorAll<HTMLElement>('[data-row]')].find((r) =>
        r.textContent?.includes(t)
      )!
      return row.offsetTop - el.scrollTop
    }, text)
  for (const expected of [70, 110, TOTAL]) {
    const text = (await rendered(page).first().innerText()).trim()
    // Прокрутка и замер — одним вызовом: событие scroll придёт позже, и
    // дорисовка начнётся уже после замера.
    const before = await list.evaluate((el, t) => {
      el.scrollTop = 0
      const row = [...el.querySelectorAll<HTMLElement>('[data-row]')].find((r) =>
        r.textContent?.includes(t)
      )!
      return row.offsetTop - el.scrollTop
    }, text)
    await expect(rendered(page)).toHaveCount(expected)
    expect(Math.abs((await placeOf(text)) - before)).toBeLessThan(2)
  }
  await expect(list.getByText('Сообщение 001')).toBeAttached()

  // Своё новое — внизу, лента не теряет ни верх, ни низ.
  const input = page.getByPlaceholder('Введите сообщение...')
  await input.fill('Новое снизу')
  await page.getByRole('button', { name: 'Отправить сообщение' }).click()
  await expect(list.getByText('Новое снизу')).toBeVisible()
  await expect(rendered(page)).toHaveCount(TOTAL + 1)
})
