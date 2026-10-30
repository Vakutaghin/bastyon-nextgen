import { test, expect, type Page } from '@playwright/test'
import { type MockNodeData } from './support/mock-node'
import { newAccounts, openChatWith, send, signedIn, type Account } from './support/live-matrix'

/**
 * Голосовое вживую, на своём Synapse и с подставным микрофоном Chromium:
 * держите — пишется, отпустили — ушло; вверх до замка — без пальца; влево —
 * отмена; короткое нажатие — подсказка. Отклик меряется в самой странице:
 * от касания до панели записи и от отпускания до обычной панели и пузыря.
 * Запуск — как matrix-receipts.live.
 */

const BASE = process.env.E2E_SYNAPSE_URL
test.skip(!BASE, 'нужен локальный Synapse, см. шапку matrix-receipts.live.spec.ts')
test.use({
  baseURL: BASE,
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
})

function profiles(alice: Account, bob: Account): MockNodeData {
  return {
    profiles: [
      { address: alice.address, name: 'alice_e2e', k: alice.keys },
      { address: bob.address, name: 'bob_e2e', k: bob.keys },
    ],
    posts: [],
    comments: [],
  }
}

interface Timings {
  /** От касания до панели записи на экране, мс. */
  panel: number | null
  /** От касания до того, как микрофон начал писать. */
  capture: number | null
  /** От отпускания до обычной панели ввода. */
  back: number | null
  /** От отпускания до пузыря голосового в чате. */
  bubble: number | null
}

/** Часы в странице: метки ставит наблюдатель DOM, а не Playwright со своей задержкой. */
async function watchTimings(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __voice: Timings & { down: number; up: number } }
    const bubbles = () =>
      document.querySelectorAll('[aria-label="Загрузка аудио"], [aria-label="Воспроизвести"]')
        .length
    let seen = bubbles()
    w.__voice = { down: 0, up: 0, panel: null, capture: null, back: null, bubble: null }
    window.addEventListener(
      'pointerdown',
      () => {
        w.__voice = {
          down: performance.now(),
          up: 0,
          panel: null,
          capture: null,
          back: null,
          bubble: null,
        }
        seen = bubbles()
      },
      true
    )
    window.addEventListener(
      'pointerup',
      () => {
        w.__voice.up = performance.now()
      },
      true
    )
    new MutationObserver(() => {
      const v = w.__voice
      const now = performance.now()
      if (v.down && v.panel === null && document.querySelector('[data-testid="voice-lock-hint"]')) {
        v.panel = now - v.down
      }
      if (
        v.down &&
        v.capture === null &&
        document.querySelector('[data-testid="voice-timer"].live')
      )
        v.capture = now - v.down
      if (
        v.up &&
        v.back === null &&
        document.querySelector('[placeholder="Введите сообщение..."]')
      ) {
        v.back = now - v.up
      }
      if (v.up && v.bubble === null && bubbles() > seen) v.bubble = now - v.up
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    })
  })
}

const timings = (page: Page) =>
  page.evaluate(() => (window as unknown as { __voice: Timings }).__voice)

test('голосовое: держать, замок, отмена, короткое нажатие — без задержек', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'подставной микрофон — только у Chromium')
  test.setTimeout(240_000)
  const [alice, bob] = await newAccounts(browser, 2)
  const data = profiles(alice!, bob!)
  const a = await signedIn(browser, alice!, data)
  const b = await signedIn(browser, bob!, data)
  await a.context().grantPermissions(['microphone'])

  await openChatWith(a, bob!, true)
  await send(a, 'привет')
  await openChatWith(b, alice!, false)
  await expect(b.getByText('привет')).toBeVisible({ timeout: 60_000 })

  const mic = a.getByRole('button', { name: 'Записать голосовое сообщение' })
  const lockHint = a.getByTestId('voice-lock-hint')
  const sentVoice = a.getByRole('button', { name: /Воспроизвести|Загрузка аудио/ })
  await watchTimings(a)

  // Держим полторы секунды и отпускаем — ушло.
  await mic.hover()
  const box = (await mic.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await a.mouse.down()
  await expect(lockHint).toBeVisible()
  await a.waitForTimeout(1500)
  await a.mouse.up()
  await expect(sentVoice).toHaveCount(1, { timeout: 15_000 })
  const hold = await timings(a)
  console.warn('voice timings (hold):', JSON.stringify(hold))
  expect(hold.panel).toBeLessThan(50)
  // Звук прогрет при открытии чата: без прогрева первое нажатие ждало 250–400 мс.
  expect(hold.capture).toBeLessThan(150)
  expect(hold.back).toBeLessThan(50)
  expect(hold.bubble).toBeLessThan(500)

  // Вверх до замка — запись идёт без кнопки; «Отправить» — ушло.
  await a.mouse.move(cx, cy)
  await a.mouse.down()
  for (let dy = 10; dy <= 90; dy += 10) await a.mouse.move(cx, cy - dy)
  await a.mouse.up()
  const sendLocked = a.getByRole('button', { name: 'Отправить голосовое сообщение' })
  await expect(sendLocked).toBeVisible()
  await a.waitForTimeout(1200)
  await expect(a.getByText('Отмена', { exact: true })).toBeVisible()
  console.warn('voice timings (lock):', JSON.stringify(await timings(a)))
  await sendLocked.click()
  await expect(sentVoice).toHaveCount(2, { timeout: 15_000 })

  // Влево — отмена: панель обычная, ничего не ушло.
  await mic.hover()
  await a.mouse.down()
  await a.waitForTimeout(800)
  for (let dx = 15; dx <= 120; dx += 15) await a.mouse.move(cx - dx, cy)
  await expect(lockHint).toHaveCount(0)
  await a.mouse.up()
  await a.waitForTimeout(1500)
  await expect(sentVoice).toHaveCount(2)

  // Нажали и сразу отпустили — подсказка, не запись.
  await mic.hover()
  await a.mouse.down()
  await a.mouse.up()
  await expect(a.getByText('Удерживайте, чтобы записать. Отпустите — отправится')).toBeVisible()
  await a.waitForTimeout(1500)
  await expect(sentVoice).toHaveCount(2)

  // У собеседника — оба голосовых.
  await expect(b.getByRole('button', { name: /Воспроизвести|Загрузка аудио/ })).toHaveCount(2, {
    timeout: 60_000,
  })

  await a.context().close()
  await b.context().close()
})
