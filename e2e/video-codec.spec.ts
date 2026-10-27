import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { useMockPeerTube, PEERTUBE_HOST, VIDEO_ID } from './support/mock-peertube'

/**
 * Окно не декодирует H.264 — так у приложения на Linux без gstreamer1.0-libav
 * (обычная Ubuntu). Раньше плеер пробовал и писал «Ошибка воспроизведения
 * видео» с «Повторить», которое не помогало. Теперь он говорит, чего не
 * хватает, а в приложении на Linux показывает команду и копирует её.
 */

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const LINUX_TAURI_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Tauri'

function nodeData(): MockNodeData {
  return {
    profiles: [ALICE],
    posts: [
      {
        txid: 'e'.repeat(64),
        address: ALICE.address,
        message: 'Ролик без кодека',
        type: 'video',
        url: `peertube://${PEERTUBE_HOST}/${VIDEO_ID}`,
      },
    ],
    comments: [],
  }
}

/** H.264 «не поддерживается»: как WebKitGTK без декодера в GStreamer. */
async function withoutH264(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const isH264 = (type: string) => /avc1|mp4a|mpegurl/i.test(type)
    if (typeof MediaSource !== 'undefined') {
      const original = MediaSource.isTypeSupported.bind(MediaSource)
      MediaSource.isTypeSupported = (type: string) => (isH264(type) ? false : original(type))
    }
    const canPlay = HTMLMediaElement.prototype.canPlayType
    HTMLMediaElement.prototype.canPlayType = function (type: string) {
      return isH264(type) ? '' : canPlay.call(this, type)
    }
  })
}

async function openAndPlay(page: Page): Promise<void> {
  await withoutH264(page)
  await useMockNode(page, nodeData())
  await useMockPeerTube(page)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  const button = page.getByRole('button', { name: 'Смотреть', exact: true })
  await button.waitFor({ timeout: 20_000 })
  await button.scrollIntoViewIfNeeded()
  await button.click()
}

test('браузер без H.264 — объяснение вместо «Повторить»', async ({ page }) => {
  await openAndPlay(page)
  await expect(page.getByText('Видео не воспроизводится: здесь нет кодека H.264')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('button', { name: 'Повторить' })).toHaveCount(0)
  await expect(page.getByTestId('video-codec-command')).toHaveCount(0)
})

test.describe('приложение на Linux', () => {
  test.use({ userAgent: LINUX_TAURI_UA })

  test('без gstreamer1.0-libav — команда и «Скопировать команду»', async ({ page, context }) => {
    await openAndPlay(page)
    await expect(page.getByText('Не хватает видеокодека H.264')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('video-codec-command')).toHaveText(
      'sudo apt install gstreamer1.0-libav'
    )
    await expect(page.getByRole('button', { name: 'Повторить' })).toHaveCount(0)

    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    await page.getByRole('button', { name: 'Скопировать команду' }).click()
    await expect(page.getByText('Команда скопирована')).toBeVisible()
  })
})
