import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Выбрали фото — пузырь в переписке сразу, с выбранным снимком и крутящимся
 * кольцом. Раньше до конца подготовки снимка (уменьшение до 2048 px — на
 * телефоне секунды) в чате не было ничего, а из нескольких фото каждое
 * следующее появлялось, только когда ушло предыдущее: «совершенно не
 * понятно, грузится ли оно». Сервера чатов нет: переписка подставлена в стор,
 * отправка до сервера не доходит — проверяем то, что видно до неё.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
const DATA: MockNodeData = {
  profiles: [{ address: BOB, name: 'bob_ng' }],
  posts: [],
  comments: [],
}
const DM = '!photos:matrix.pocketnet.app'

async function signIn(page: Page): Promise<void> {
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
}

/** Снимок как с телефона: 4000×3000, его ещё уменьшать до 2048. */
async function bigJpeg(page: Page, hue: number): Promise<Buffer> {
  const b64 = await page.evaluate((h) => {
    const c = document.createElement('canvas')
    c.width = 4000
    c.height = 3000
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 4000, 3000)
    g.addColorStop(0, `hsl(${h} 80% 50%)`)
    g.addColorStop(1, `hsl(${h + 60} 80% 30%)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4000, 3000)
    return c.toDataURL('image/jpeg', 0.92).split(',')[1]!
  }, hue)
  return Buffer.from(b64, 'base64')
}

test('несколько фото: пузыри всех — сразу, с выбранным снимком и кольцом отправки', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signIn(page)
  const photos = await Promise.all(
    [0, 120, 240].map(async (hue, i) => ({
      name: `IMG_${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      buffer: await bigJpeg(page, hue),
    }))
  )

  await page.evaluate(
    async ({ dm, bob }) => {
      const s = (
        document.querySelector('#app') as unknown as {
          __vue_app__: {
            config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
          }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const ui = s.get('messenger-ui') as unknown as {
        setDialogs: (d: unknown[]) => void
        switchToChat: (id: string) => void
      }
      ui.setDialogs([{ id: dm, partner: { id: bob, name: 'bob_ng' }, unreadCount: 0 }])
      await (
        s.get('messenger') as unknown as { openMessenger: () => Promise<void> }
      ).openMessenger()
      const messages = (
        s.get('messenger-chat') as unknown as { messages: Record<string, unknown[]> }
      ).messages
      messages[dm] = [
        {
          id: '$hello',
          chatId: dm,
          senderId: bob,
          text: 'Пришли фото',
          timestamp: Date.now() - 60_000,
          read: true,
          status: 'sent',
        },
      ]
      ui.switchToChat(dm)
    },
    { dm: DM, bob: mx(BOB) }
  )
  const list = page.getByTestId('message-list')
  await expect(list.getByText('Пришли фото')).toBeVisible({ timeout: 30_000 })

  await page.locator('input[type="file"][accept="image/*"]').setInputFiles(photos)

  // Все три пузыря и все три кольца — одновременно: фото не ждут друг друга.
  // Прежде следующее появлялось, когда предыдущее уже закончило, — колец
  // больше одного не бывало.
  const rings = list.getByTestId('image-uploading')
  await expect(rings).toHaveCount(3, { timeout: 5_000 })
  // В пузыре — выбранный снимок, уже показанный.
  const shown = await list
    .locator('img[src^="blob:"]')
    .evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).naturalWidth))
  expect(shown).toHaveLength(3)
  expect(shown.every((w) => w > 0)).toBe(true)
})
