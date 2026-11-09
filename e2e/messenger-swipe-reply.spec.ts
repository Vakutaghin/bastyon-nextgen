import { test, expect, type CDPSession, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Ответ смахиванием на телефоне, как в Telegram: настоящие касания (CDP
 * Input.dispatchTouchEvent) — браузер сам решает, прокрутка это или жест,
 * поэтому видно, что горизонтальное движение пальца доходит до ленты, а
 * вертикальное остаётся прокруткой. Сервера чатов нет: переписка подставлена
 * в стор, вход в Matrix оборван.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
const DATA: MockNodeData = { profiles: [{ address: BOB, name: 'bob_ng' }], posts: [], comments: [] }
const DM = '!dm:matrix.pocketnet.app'
const TOTAL = 40

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function openChat(page: Page): Promise<void> {
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

/** Палец от (x0, y0) до (x1, y1) за `steps` шагов, по 16 мс. */
async function touchDrag(
  cdp: CDPSession,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  steps = 12
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: x0, y: y0 }],
  })
  for (let i = 1; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps
    const y = y0 + ((y1 - y0) * i) / steps
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
    await new Promise((resolve) => setTimeout(resolve, 16))
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

// Касания идут через CDP (Input.dispatchTouchEvent) — он есть только в Chromium.
test.skip(({ browserName }) => browserName !== 'chromium', 'касания через CDP — только Chromium')

test('смахнули сообщение влево — ответ на него; вверх-вниз — прокрутка без ответа', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openChat(page)
  const list = page.getByTestId('message-list')
  const message = list.getByText('Сообщение 038')
  await expect(message).toBeVisible({ timeout: 30_000 })
  const cdp = await page.context().newCDPSession(page)

  // Чуть-чуть влево — не ответ.
  let box = (await message.boundingBox())!
  const y = box.y + box.height / 2
  await touchDrag(cdp, box.x + box.width / 2, y, box.x + box.width / 2 - 30, y)
  await page.waitForTimeout(300)
  await expect(page.getByTestId('reply-banner')).toHaveCount(0)

  // Дальше порога — ответ на это сообщение.
  box = (await message.boundingBox())!
  await touchDrag(cdp, box.x + box.width / 2, y, box.x + box.width / 2 - 120, y)
  const banner = page.getByTestId('reply-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('Сообщение 038')
  await banner.getByRole('button', { name: 'Отмена' }).click()
  await expect(banner).toHaveCount(0)

  // Вертикально — лента прокручивается, ответа нет.
  const before = await list.evaluate((el) => el.scrollTop)
  box = (await list.boundingBox())!
  const x = box.x + box.width / 2
  await touchDrag(cdp, x, box.y + box.height * 0.3, x - 20, box.y + box.height * 0.8)
  await page.waitForTimeout(500)
  expect(await list.evaluate((el) => el.scrollTop)).toBeLessThan(before)
  await expect(page.getByTestId('reply-banner')).toHaveCount(0)
})
