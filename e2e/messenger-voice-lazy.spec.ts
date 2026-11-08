import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Голосовые в чате грузятся по «Слушать», а не при открытии чата: волна —
 * из события (`info.waveform`, как у Forta Chat), длительность — тоже; сам
 * звук сервер отдаёт только на нажатие, и только один раз.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
const DM = '!dm:matrix.pocketnet.app'
const MEDIA = 'https://matrix.pocketnet.app/_matrix/media/v3/download/matrix.pocketnet.app'

const DATA: MockNodeData = {
  profiles: [{ address: ALICE, name: 'alice_ng' }],
  posts: [],
  comments: [],
}

type Stores = Map<string, Record<string, (...args: unknown[]) => unknown>>

/** Две секунды синуса с плавающей громкостью (иначе волна ровная) — WAV, который декодирует браузер. */
function wav(seconds = 2, rate = 8000): Buffer {
  const n = rate * seconds
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    const loud = 0.15 + 0.85 * Math.abs(Math.sin((i / rate) * Math.PI * 1.5))
    buf.writeInt16LE(Math.round(Math.sin(i / 10) * 8000 * loud), 44 + i * 2)
  }
  return buf
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

/** Вход в мессенджер кончился (без сервера чатов — неудачей): ленту он больше не перепишет. */
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

/** Личный чат с двумя голосовыми: с волной в событии (Forta Chat) и без неё (прежний Bastyon). */
async function openChatWithVoices(page: Page): Promise<void> {
  await loginSettled(page)
  await page.evaluate(
    async ({ dm, alice, media }) => {
      const app = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__
      const stores = app.config.globalProperties.$pinia._s
      const now = Date.now()
      const voice = (id: string, ts: number, info: Record<string, unknown>) => ({
        id,
        chatId: dm,
        senderId: alice,
        text: '',
        type: 'audio',
        url: `${media}/${id.slice(1)}`,
        info: { mimetype: 'audio/wav', size: 32044, ...info },
        timestamp: ts,
        read: true,
        status: 'sent',
      })
      stores.get('messenger-ui')!.setDialogs!([
        { id: dm, partner: { id: alice, name: 'alice_ng' }, unreadCount: 0 },
      ])
      await stores.get('messenger')!.openMessenger!()
      const chat = stores.get('messenger-chat') as unknown as {
        messages: Record<string, unknown[]>
      }
      const wave = Array.from({ length: 50 }, (_, i) => Math.round(((i % 10) / 9) * 1024))
      chat.messages[dm] = [
        voice('$withwave', now - 120_000, { duration: 2000, waveform: wave }),
        voice('$nowave', now - 60_000, {}),
      ]
      stores.get('messenger-ui')!.switchToChat!(dm)
    },
    { dm: DM, alice: mx(ALICE), media: MEDIA }
  )
}

/** Сколько разных высот у столбиков волны: ровная линия — одна. */
async function barHeights(page: Page, index: number): Promise<number> {
  return page
    .getByTestId('audio-message')
    .nth(index)
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!
      const { width, height } = canvas
      const data = ctx.getImageData(0, 0, width, height).data
      const heights = new Set<number>()
      for (let x = 0; x < width; x++) {
        let h = 0
        for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3]! > 0) h++
        if (h > 0) heights.add(h)
      }
      return heights.size
    })
}

test('голосовые: при открытии чата звук не качается, волна — из события; «Слушать» качает один раз', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  const fetched: string[] = []
  await page.route('**/_matrix/media/**', (route) => {
    fetched.push(route.request().url())
    return route.fulfill({
      status: 200,
      body: wav(),
      headers: { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' },
    })
  })

  await signIn(page)
  await openChatWithVoices(page)
  const voices = page.getByTestId('audio-message')
  await expect(voices).toHaveCount(2, { timeout: 30_000 })

  // Длительность и волна — из события, звук не нужен.
  await expect(voices.nth(0).getByTestId('audio-time')).toHaveText('0:02')
  await expect.poll(() => barHeights(page, 0)).toBeGreaterThan(3)
  // Без волны в событии — ровная линия, пока звук не скачан.
  expect(await barHeights(page, 1)).toBeLessThanOrEqual(2)
  await page.waitForTimeout(1_500)
  expect(fetched).toEqual([])

  // «Слушать» у голосового без волны: один запрос, играет, волна — по звуку.
  await voices.nth(1).getByRole('button', { name: 'Воспроизвести' }).click()
  await expect(voices.nth(1).getByRole('button', { name: 'Пауза' })).toBeVisible({
    timeout: 15_000,
  })
  expect(fetched).toHaveLength(1)
  expect(fetched[0]).toContain('/nowave')
  await expect.poll(() => barHeights(page, 1)).toBeGreaterThan(3)

  // Пауза и снова «Слушать» — без нового запроса.
  await voices.nth(1).getByRole('button', { name: 'Пауза' }).click()
  await voices.nth(1).getByRole('button', { name: 'Воспроизвести' }).click()
  await expect(voices.nth(1).getByRole('button', { name: 'Пауза' })).toBeVisible()
  expect(fetched).toHaveLength(1)
})
