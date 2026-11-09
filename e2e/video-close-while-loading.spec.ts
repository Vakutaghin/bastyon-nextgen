import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, VIDEO_URL, type MockPeerTubeOptions } from './support/mock-peertube'
import { skipWithoutWebKitMedia } from './support/webkit-media'

/**
 * Плеер закрыли, пока ролик грузился, — ролик не должен заиграть потом.
 * Жалоба с Windows: ролик подвис на загрузке, окно закрыли, а через время он
 * «раздуплился» и бубнил параллельно с другим плеером; остановить было нечем.
 * Закрытый плеер уже вне страницы: его `<video>` никто не видит и правило
 * «играет один» на него не действует.
 */

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [
    {
      txid: 'e'.repeat(64),
      address: ALICE.address,
      message: 'Ролик для проверки закрытия плеера',
      type: 'video',
      url: VIDEO_URL,
    },
  ],
  comments: [],
}

const DELAY_MS = 3_000

/** Помнит каждый `<video>` и `<audio>`, которому сказали play(), — и вне страницы тоже. */
function trackPlayback(page: Page): Promise<void> {
  return page.addInitScript(() => {
    const played = new Set<HTMLMediaElement>()
    const w = window as unknown as {
      __detachedPlays: number
      __orphansPlaying: () => number
    }
    w.__detachedPlays = 0
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      played.add(this)
      if (!this.isConnected) w.__detachedPlays += 1
      return play.call(this)
    }
    w.__orphansPlaying = () => [...played].filter((m) => !m.isConnected && !m.paused).length
  })
}

async function open(page: Page, options: MockPeerTubeOptions) {
  await trackPlayback(page)
  await useMockNode(page, DATA)
  const mock = await useMockPeerTube(page, options)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  return mock
}

/** Пуск — и сразу уход со страницы, пока ролик ещё грузится. */
async function startAndLeave(page: Page) {
  const play = page.getByRole('button', { name: 'Смотреть', exact: true })
  await play.waitFor({ timeout: 20_000 })
  await play.scrollIntoViewIfNeeded()
  await play.click()
  await expect(page.locator('video').first()).toBeAttached()
  await page.evaluate(() => {
    const app = document.querySelector('#app') as unknown as {
      __vue_app__: { config: { globalProperties: { $router: { push: (to: string) => unknown } } } }
    }
    return app.__vue_app__.config.globalProperties.$router.push('/help')
  })
  await expect(page).toHaveURL(/\/help/)
  await expect(page.locator('video')).toHaveCount(0)
}

const playback = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __detachedPlays: number; __orphansPlaying: () => number }
    return { detachedPlays: w.__detachedPlays, orphansPlaying: w.__orphansPlaying() }
  })

test('сервер ответил после закрытия плеера — ролик не запускается и не грузится', async ({
  page,
}) => {
  const mock = await open(page, { hls: true, apiDelayMs: DELAY_MS })
  await startAndLeave(page)

  // Сервер «додумал»; раньше в этот момент закрытый плеер брал поток и играл.
  await page.waitForTimeout(DELAY_MS + 3_000)
  expect(await playback(page)).toEqual({ detachedPlays: 0, orphansPlaying: 0 })
  expect(mock.requests).toEqual({ hls: 0, mp4: 0 })
})

test('прямой mp4 догрузился после закрытия плеера — ролик не запускается', async ({ page }) => {
  skipWithoutWebKitMedia()
  const mock = await open(page, { mp4DelayMs: DELAY_MS })
  await startAndLeave(page)

  await page.waitForTimeout(DELAY_MS + 3_000)
  expect(await playback(page)).toEqual({ detachedPlays: 0, orphansPlaying: 0 })
  expect(mock.requests.mp4).toBeGreaterThan(0)
})
