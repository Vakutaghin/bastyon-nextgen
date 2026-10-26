import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, VIDEO_URL } from './support/mock-peertube'

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = {
  profiles: [ALICE],
  posts: [
    {
      txid: 'e'.repeat(64),
      address: ALICE.address,
      message: 'Ролик для проверки плеера',
      type: 'video',
      url: VIDEO_URL,
    },
  ],
  comments: [],
}

async function open(page: Page) {
  await useMockNode(page, DATA)
  await useMockPeerTube(page)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

const pipState = (page: Page) =>
  page.evaluate(() => {
    const v = document.pictureInPictureElement as HTMLVideoElement | null
    return v
      ? { pip: true, paused: v.paused, time: v.currentTime, inDoc: v.isConnected }
      : { pip: false, paused: true, time: 0, inDoc: false }
  })

/**
 * «Картинка в картинке» живёт дольше плеера: ушли из ленты в другой раздел —
 * ролик доигрывает в окне. Раньше плеер при уходе ставил его на паузу в
 * начало и закрывал поток — в окне оставался стоп-кадр без кнопки «пуск».
 * PiP без экрана есть только у Chromium (на Windows окно рисует он же).
 */
test('ролик в «картинке в картинке» доигрывает после ухода со страницы', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'PiP без экрана — только Chromium')
  await open(page)
  const play = page.getByRole('button', { name: 'Смотреть', exact: true })
  await play.waitFor({ timeout: 20_000 })
  await play.scrollIntoViewIfNeeded()
  await play.click()
  const video = page.locator('video').first()
  await expect
    .poll(async () => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 })
    .toBeGreaterThan(0.5)
  await video.hover()
  await page.getByRole('button', { name: 'Картинка в картинке' }).click()
  await expect.poll(async () => (await pipState(page)).pip).toBe(true)
  expect((await pipState(page)).paused).toBe(false)

  // Уходим из ленты: плеер размонтирован, ролик идёт дальше и остаётся в документе.
  await page.evaluate(() =>
    (
      document.querySelector('#app') as unknown as { __vue_app__: any }
    ).__vue_app__.config.globalProperties.$router.push('/help')
  )
  await expect(page).toHaveURL(/\/help/)
  const left = await pipState(page)
  expect(left).toMatchObject({ pip: true, paused: false, inDoc: true })
  await expect.poll(async () => (await pipState(page)).time).toBeGreaterThan(left.time + 0.5)

  // Окно закрыли — ролик останавливается и убирается.
  await page.evaluate(() => document.exitPictureInPicture())
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll('[data-pip-keeper] video').length))
    .toBe(0)
})
