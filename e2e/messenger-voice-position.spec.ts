import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Голосовое как в Telegram: до прослушивания — длительность, с первого нажатия
 * — где играет; пауза, другое голосовое или уход в другой чат оставляют
 * сообщение на месте остановки, «Воспроизвести» продолжает с него; дослушали —
 * снова длительность. Длительность видна и до загрузки файла (из события), и у
 * записи MediaRecorder в Chromium, где у самого файла её нет (Infinity).
 * Сервера чатов нет: переписка подставлена в стор, файлы отдаёт тест.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const CAROL = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
const DATA: MockNodeData = {
  profiles: [
    { address: BOB, name: 'bob_ng' },
    { address: CAROL, name: 'carol_ng' },
  ],
  posts: [],
  comments: [],
}
const DM = '!dm:matrix.pocketnet.app'
const DM_CAROL = '!carol:matrix.pocketnet.app'
/** Длина записи A, с. */
const A_SECONDS = 5
const MP3 = readFileSync(join(process.cwd(), 'e2e/fixtures/test-audio.mp3'))

/** Голосовое, записанное MediaRecorder в самой странице, — как у отправителя. */
async function recordVoice(page: Page, seconds: number): Promise<{ type: string; body: Buffer }> {
  const { type, b64 } = await page.evaluate(async (ms) => {
    const ctx = new AudioContext()
    await ctx.resume()
    const osc = ctx.createOscillator()
    const dest = ctx.createMediaStreamDestination()
    osc.connect(dest)
    osc.start()
    const mime = ['audio/webm;codecs=opus', 'audio/mp4'].find((t) =>
      MediaRecorder.isTypeSupported(t)
    )
    const rec = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    const stopped = new Promise((resolve) => (rec.onstop = resolve))
    rec.start()
    await new Promise((resolve) => setTimeout(resolve, ms))
    rec.stop()
    await stopped
    osc.stop()
    await ctx.close()
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
    let bin = ''
    for (const byte of bytes) bin += String.fromCharCode(byte)
    return { type: rec.mimeType, b64: btoa(bin) }
  }, seconds * 1000)
  return { type, body: Buffer.from(b64, 'base64') }
}

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

async function switchTo(page: Page, chatId: string): Promise<void> {
  await page.evaluate((id) => {
    const s = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
        }
      }
    ).__vue_app__.config.globalProperties.$pinia._s
    ;(s.get('messenger-ui') as unknown as { switchToChat: (id: string) => void }).switchToChat(id)
  }, chatId)
}

const timeOf = (voice: Locator) => voice.getByTestId('audio-time')
const secondsOf = async (voice: Locator): Promise<number> => {
  const [m, s] = (await timeOf(voice).innerText()).trim().split(':').map(Number)
  return (m ?? 0) * 60 + (s ?? 0)
}

test('голосовое: длительность сразу, время по ходу, остановка запоминается у сообщения', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signIn(page)
  const voiceA = await recordVoice(page, A_SECONDS)

  let releaseB = () => {}
  const bGate = new Promise<void>((resolve) => (releaseB = resolve))
  await page.route('**/e2e-media/voice-a', (route) =>
    route.fulfill({ status: 200, contentType: voiceA.type, body: voiceA.body })
  )
  await page.route('**/e2e-media/voice-b', async (route) => {
    await bGate
    await route.fulfill({ status: 200, contentType: 'audio/mpeg', body: MP3 })
  })

  await page.evaluate(
    async ({ dm, carolDm, bob, carol, type, size }) => {
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
      ui.setDialogs([
        { id: dm, partner: { id: bob, name: 'bob_ng' }, unreadCount: 0 },
        { id: carolDm, partner: { id: carol, name: 'carol_ng' }, unreadCount: 0 },
      ])
      await (
        s.get('messenger') as unknown as { openMessenger: () => Promise<void> }
      ).openMessenger()
      const now = Date.now()
      const media = (name: string) => new URL(`/e2e-media/${name}`, location.href).href
      const messages = (
        s.get('messenger-chat') as unknown as { messages: Record<string, unknown[]> }
      ).messages
      messages[dm] = [
        // Прежний Bastyon длительность в событие не пишет.
        {
          id: '$voice-a',
          chatId: dm,
          senderId: bob,
          text: '',
          type: 'audio',
          url: media('voice-a'),
          info: { mimetype: type, size },
          timestamp: now - 120_000,
          read: true,
          status: 'sent',
        },
        {
          id: '$voice-b',
          chatId: dm,
          senderId: '@me:matrix.pocketnet.app',
          text: '',
          type: 'audio',
          url: media('voice-b'),
          info: { mimetype: 'audio/mpeg', duration: 2000 },
          timestamp: now - 60_000,
          read: true,
          status: 'sent',
        },
      ]
      messages[carolDm] = [
        {
          id: '$carol-1',
          chatId: carolDm,
          senderId: carol,
          text: 'Привет от Кэрол',
          timestamp: now - 30_000,
          read: true,
          status: 'sent',
        },
      ]
      ui.switchToChat(dm)
    },
    {
      dm: DM,
      carolDm: DM_CAROL,
      bob: mx(BOB),
      carol: mx(CAROL),
      type: voiceA.type,
      size: voiceA.body.length,
    }
  )

  const list = page.getByTestId('message-list')
  const voices = list.getByTestId('audio-message')
  await expect(voices).toHaveCount(2, { timeout: 30_000 })
  const a = voices.nth(0)
  const b = voices.nth(1)
  const play = (voice: Locator) => voice.getByRole('button', { name: 'Воспроизвести' })
  const pause = (voice: Locator) => voice.getByRole('button', { name: 'Пауза' })

  // В событии длительности нет, у записи Chromium нет и в файле — по звуку.
  await expect(timeOf(a)).toHaveText(`0:0${A_SECONDS}`, { timeout: 15_000 })
  // Длительность из события — пока файл ещё грузится.
  await expect(b.getByRole('button', { name: 'Загрузка аудио' })).toBeVisible()
  await expect(timeOf(b)).toHaveText('0:02')
  releaseB()

  // Играет — время с начала; пауза — время остановки остаётся.
  await play(a).click()
  await expect(timeOf(a)).toHaveText('0:01', { timeout: 5_000 })
  await pause(a).click()
  const paused = await secondsOf(a)
  expect(paused).toBeGreaterThanOrEqual(1)
  expect(paused).toBeLessThan(A_SECONDS)
  await page.waitForTimeout(1_200)
  expect(await secondsOf(a)).toBe(paused)

  // Продолжает с места; другое голосовое останавливает его, место — за ним.
  await play(a).click()
  await expect(timeOf(a)).toHaveText(`0:0${paused + 1}`, { timeout: 5_000 })
  await play(b).click()
  await expect(play(a)).toBeVisible()
  const stoppedAt = await secondsOf(a)
  expect(stoppedAt).toBeGreaterThanOrEqual(paused + 1)

  // Дослушали — снова длительность.
  await expect(pause(b)).toBeVisible()
  await expect(play(b)).toBeVisible({ timeout: 6_000 })
  await expect(timeOf(b)).toHaveText('0:02')
  expect(await secondsOf(a)).toBe(stoppedAt)

  // Ушли в другой чат и вернулись — место остановки то же.
  await switchTo(page, DM_CAROL)
  await expect(list.getByText('Привет от Кэрол')).toBeVisible()
  await switchTo(page, DM)
  await expect(voices).toHaveCount(2)
  await expect(timeOf(a)).toHaveText(`0:0${stoppedAt}`)

  // И продолжает с него: доиграет быстрее, чем с начала.
  await expect(play(a)).toBeVisible({ timeout: 15_000 })
  const started = Date.now()
  await play(a).click()
  await page.waitForTimeout(300)
  expect(await secondsOf(a)).toBeGreaterThanOrEqual(stoppedAt)
  await expect(play(a)).toBeVisible({ timeout: 10_000 })
  expect(Date.now() - started).toBeLessThan((A_SECONDS - stoppedAt + 0.8) * 1000)
  await expect(timeOf(a)).toHaveText(`0:0${A_SECONDS}`)
})
