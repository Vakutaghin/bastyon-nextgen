import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Картинка в чате сразу своего размера. Пузырь сообщения сжимается по
 * содержимому, и рамка с одной лишь max-width, пока картинка качалась и
 * расшифровывалась, была шириной со спиннер, а через 5–10 секунд вырастала.
 * Картинку придерживаем, пока не измерим рамку. Без сервера чатов: состояние
 * подставлено в сторы.
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

const DM = '!pics:matrix.pocketnet.app'
// 426 × 240.
const JPG = 'e2e/fixtures/test-video.jpg'
const SIZED = 'https://media.test/sized.jpg'
const UNSIZED = 'https://media.test/unsized.jpg'

type Stores = Map<string, Record<string, unknown>>

async function openChatWithImages(page: Page): Promise<void> {
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

  await page.evaluate(
    async ({ dm, bob, sized, unsized }) => {
      const stores = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const ui = stores.get('messenger-ui') as Record<string, (...a: unknown[]) => unknown>
      const chat = stores.get('messenger-chat') as { messages: Record<string, unknown[]> }
      const now = Date.now()
      const base = { chatId: dm, senderId: bob, text: '', read: true, status: 'sent' }
      chat.messages[dm] = [
        {
          ...base,
          id: '$sized',
          type: 'image',
          url: sized,
          info: { name: 'sized.jpg', w: 426, h: 240, httpUrl: sized },
          timestamp: now - 120_000,
        },
        // Старые клиенты размер не шлют.
        {
          ...base,
          id: '$unsized',
          type: 'image',
          url: unsized,
          info: { name: 'unsized.jpg', httpUrl: unsized },
          timestamp: now - 60_000,
        },
      ]
      ui.setDialogs!([{ id: dm, partner: { id: bob, name: 'bob_ng' }, unreadCount: 0 }])
      await (stores.get('messenger') as Record<string, () => Promise<void>>).openMessenger!()
      ui.switchToChat!(dm)
    },
    { dm: DM, bob: mx(BOB), sized: SIZED, unsized: UNSIZED }
  )
}

/** Ширина рамки вокруг картинки — по раскладке: окно мессенджера открывается с масштабом. */
async function frameWidth(page: Page, name: string): Promise<number> {
  return page
    .locator(`img[alt="${name}"]`)
    .first()
    .evaluate((img) => img.parentElement!.offsetWidth)
}

test('картинка в чате не меняет размер, когда загрузится', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1400, height: 900 })

  let release!: () => void
  const released = new Promise<void>((r) => (release = r))
  await page.route('https://media.test/**', async (route) => {
    await released
    await route.fulfill({ path: JPG, contentType: 'image/jpeg' })
  })

  await openChatWithImages(page)
  const sized = page.locator('img[alt="sized.jpg"]').first()
  await expect(sized).toBeAttached({ timeout: 30_000 })
  await expect(page.locator('img[alt="unsized.jpg"]').first()).toBeAttached()

  // Картинки ещё не пришли, а рамки уже полной ширины: 280 или сколько даёт
  // пузырь в узком окне мессенджера. Раньше — шириной со спиннер.
  const sizedBefore = await frameWidth(page, 'sized.jpg')
  const unsizedBefore = await frameWidth(page, 'unsized.jpg')
  expect(sizedBefore).toBeGreaterThan(150)
  expect(sizedBefore).toBeLessThanOrEqual(280)
  expect(unsizedBefore).toBe(sizedBefore)

  release()
  const natural = (name: string) =>
    page
      .locator(`img[alt="${name}"]`)
      .first()
      .evaluate((img) => (img as HTMLImageElement).naturalWidth)
  await expect.poll(() => natural('sized.jpg')).toBe(426)
  await expect.poll(() => natural('unsized.jpg')).toBe(426)

  expect(await frameWidth(page, 'sized.jpg')).toBe(sizedBefore)
  // Без размера в сообщении пропорции — по самой картинке, 426 × 240.
  const unsized = await page
    .locator('img[alt="unsized.jpg"]')
    .first()
    .evaluate((img) => {
      const frame = img.parentElement!
      return { w: frame.offsetWidth, ratio: frame.offsetWidth / frame.offsetHeight }
    })
  expect(unsized.w).toBe(unsizedBefore)
  expect(unsized.ratio).toBeCloseTo(426 / 240, 1)
})
