import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { skipWithoutWebKitMedia } from './support/webkit-media'

/**
 * Скорость голосового, как в Telegram: с первого «Воспроизвести» рядом со
 * временем — кнопка «1×», нажатия переключают 1 → 1,25 → 1,5 → 1,75 → 2 → 1.
 * Скорость одна на все голосовые и запоминается на устройстве: другое
 * голосовое сразу играет с ней, и при 2× — правда вдвое быстрее. Жалоба была про групповой чат — он и в тесте.
 * Сервера чатов нет: переписка подставлена в стор, звук отдаёт тест.
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
const GROUP = '!group:matrix.pocketnet.app'
/** Длина записи, с. */
const SECONDS = 4

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

test('голосовое в группе: скорость 1× → 2× по кругу, запоминается, при 2× играет вдвое быстрее', async ({
  page,
}) => {
  skipWithoutWebKitMedia()
  test.setTimeout(120_000)
  // Как звучало: скорость при старте и сколько играло — по часам страницы,
  // от «playing» до «ended» (задержки самого теста в замер не входят).
  await page.addInitScript(() => {
    const w = window as unknown as { __plays: Array<{ rate: number; ms?: number; dur?: number }> }
    w.__plays = []
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      const el = this as HTMLMediaElement & { __timed?: boolean }
      if (!el.__timed) {
        el.__timed = true
        let entry: { rate: number; ms?: number; dur?: number; at: number } | null = null
        el.addEventListener('playing', () => {
          entry = { rate: el.playbackRate, at: performance.now() }
          w.__plays.push(entry)
        })
        el.addEventListener('ended', () => {
          if (!entry) return
          entry.ms = performance.now() - entry.at
          entry.dur = el.duration
        })
      }
      return play.call(this)
    }
  })
  await signIn(page)
  const voice = await recordVoice(page, SECONDS)
  await page.route('**/e2e-media/voice', (route) =>
    route.fulfill({ status: 200, contentType: voice.type, body: voice.body })
  )

  await page.evaluate(
    async ({ group, bob, carol, type, size, ms }) => {
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
        {
          id: group,
          partner: { id: group, name: 'Голосовые' },
          unreadCount: 0,
          group: { memberCount: 3, previewIds: [bob, carol] },
        },
      ])
      await (
        s.get('messenger') as unknown as { openMessenger: () => Promise<void> }
      ).openMessenger()
      const messages = (
        s.get('messenger-chat') as unknown as { messages: Record<string, unknown[]> }
      ).messages
      messages[group] = [carol, bob].map((sender, i) => ({
        id: `$voice-${i}`,
        chatId: group,
        senderId: sender,
        text: '',
        type: 'audio',
        url: new URL('/e2e-media/voice', location.href).href,
        info: { mimetype: type, size, duration: ms },
        timestamp: Date.now() - 60_000 + i * 1000,
        read: true,
        status: 'sent',
      }))
      ui.switchToChat(group)
    },
    {
      group: GROUP,
      bob: mx(BOB),
      carol: mx(CAROL),
      type: voice.type,
      size: voice.body.length,
      ms: SECONDS * 1000,
    }
  )

  const voices = page.getByTestId('message-list').getByTestId('audio-message')
  await expect(voices).toHaveCount(2, { timeout: 30_000 })
  const bubble = voices.nth(0)
  const other = voices.nth(1)
  const play = (v: Locator) => v.getByRole('button', { name: 'Воспроизвести' })
  const rate = bubble.getByTestId('voice-rate')
  const otherRate = other.getByTestId('voice-rate')

  // До прослушивания кнопки скорости нет — только длительность.
  await expect(bubble.getByTestId('audio-time')).toHaveText('0:04')
  await expect(rate).toHaveCount(0)

  await play(bubble).click()
  await expect(rate).toHaveText('1×')
  await expect(rate).toHaveAttribute('aria-label', 'Скорость воспроизведения: 1×')
  for (const label of ['1,25×', '1,5×', '1,75×', '2×']) {
    await rate.click()
    await expect(rate).toHaveText(label)
  }
  // Нажатие по кнопке скорости не ставит на паузу.
  await expect(bubble.getByRole('button', { name: 'Пауза' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('BST_VOICE_PLAYBACK_RATE'))).toBe('2')

  // Дослушали — снова длительность, кнопка скорости ушла.
  await expect(play(bubble)).toBeVisible({ timeout: 10_000 })
  await expect(rate).toHaveCount(0)

  // Другое голосовое — сразу при 2×: запись играет вдвое быстрее, а не как есть.
  await expect(otherRate).toHaveCount(0)
  await play(other).click()
  await expect(otherRate).toHaveText('2×')
  await expect(play(other)).toBeVisible({ timeout: 10_000 })
  const last = await page.evaluate(() => {
    const plays = (
      window as unknown as { __plays: Array<{ rate: number; ms?: number; dur?: number }> }
    ).__plays
    return plays[plays.length - 1]!
  })
  expect(last.rate).toBe(2)
  const real = (last.dur ?? 0) * 1000
  expect(real).toBeGreaterThan(SECONDS * 1000 * 0.8)
  expect(last.ms!).toBeLessThan(real * 0.7)
  expect(last.ms!).toBeGreaterThan(real * 0.4)

  // После 2× — снова 1×, и запись убрана.
  await play(other).click()
  await otherRate.click()
  await expect(otherRate).toHaveText('1×')
  expect(await page.evaluate(() => localStorage.getItem('BST_VOICE_PLAYBACK_RATE'))).toBeNull()
})
