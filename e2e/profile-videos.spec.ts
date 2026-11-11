import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData, type MockPost } from './support/mock-node'

/**
 * Вкладка «Видео» в профиле на подменной ноде: подгрузка «Новых», поиск только
 * по роликам автора, порядок (кроме «Новых» нода отдаёт первые 20 — об этом
 * подпись) и тема из меток роликов. В сеть ничего не уходит.
 */

const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const BOB = { address: 'PAmockBob222222222222222222222222', name: 'tester_bob' }

const txid = (n: number): string => n.toString(16).padStart(64, '0')

/** 21 ролик Алисы: №1 — самый свежий, №21 — самый старый. У каждого третьего — #music. */
const VIDEOS: MockPost[] = Array.from({ length: 21 }, (_, i) => {
  const n = i + 1
  return {
    txid: txid(n),
    address: ALICE.address,
    message: '',
    caption: n === 5 ? 'Котики на море' : `Ролик ${n}`,
    type: 'video',
    url: `peertube://peertube101.pocketnet.app/aaaaaaaa-0000-0000-0000-${String(n).padStart(12, '0')}`,
    tags: n % 3 === 0 ? ['music', 'live'] : ['live'],
    // Больше всех оценок у №7, комментариев — у №12.
    scores: n === 7 ? 50 : n,
    comments: n === 12 ? 40 : 1,
    ago: 600 * n,
  }
})

const DATA: MockNodeData = {
  profiles: [ALICE, BOB],
  posts: [
    ...VIDEOS,
    { txid: txid(100), address: ALICE.address, message: 'Котики — просто пост', type: 'share' },
    {
      txid: txid(101),
      address: BOB.address,
      message: '',
      caption: 'Котики у Боба',
      type: 'video',
      url: 'peertube://peertube101.pocketnet.app/bbbbbbbb-0000-0000-0000-000000000001',
    },
  ],
  comments: [],
}

async function openVideos(page: Page, query = ''): Promise<void> {
  await page.goto(`/${ALICE.address}?tab=video${query}`)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

const cards = (page: Page) => page.getByTestId('video-grid').getByTestId('video-card')
/** Подпись ролика №n — и не №1x/№2x. */
const nth = (n: number): RegExp => new RegExp(`Ролик ${n}(?!\\d)`)

// Приложение поднимается на каждой странице заново, а тесты идут параллельно.
test.describe.configure({ timeout: 60_000 })

/** Вкладка открыта: первая страница «Новых» на месте. */
async function ready(page: Page): Promise<void> {
  await expect(cards(page).first()).toContainText(nth(1), { timeout: 30_000 })
}

test('«Новые»: по 20, дальше подгружаются при прокрутке', async ({ page }) => {
  await useMockNode(page, DATA)
  await openVideos(page)
  await ready(page)
  await page.mouse.wheel(0, 4000)
  await expect(cards(page)).toHaveCount(21)
  await expect(cards(page).last()).toContainText(nth(21))
  await expect(page.getByTestId('profile-video-capped')).toHaveCount(0)
})

test('поиск — только ролики автора; крестик возвращает все', async ({ page }) => {
  await useMockNode(page, DATA)
  await openVideos(page)
  await ready(page)
  const search = page.getByTestId('profile-video-tools').getByRole('textbox')
  await search.fill('котики')
  await search.press('Enter')
  await expect(page).toHaveURL(/[?&]q=/)
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Котики на море')
  await expect(page.getByTestId('profile-video-tools')).toContainText('котики')
  // Порядок и тема к выдаче поиска не относятся.
  await expect(page.getByTestId('profile-video-order-popular')).toHaveCount(0)
  await search.fill('')
  await expect(page).not.toHaveURL(/[?&]q=/)
  await ready(page)
})

test('порядок: популярные, обсуждаемые, старые — первые 20 с подписью', async ({ page }) => {
  await useMockNode(page, DATA)
  await openVideos(page)
  await ready(page)

  await page.getByTestId('profile-video-order-popular').click()
  await expect(page).toHaveURL(/sort=popular/)
  await expect(cards(page).first()).toContainText(nth(7))
  await expect(page.getByTestId('profile-video-order-popular')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(page.getByTestId('profile-video-capped')).toContainText('20 самых популярных')
  // Дальше нода в этом порядке не отдаёт — и не просим.
  await page.mouse.wheel(0, 4000)
  await expect(cards(page)).toHaveCount(20)

  await page.getByTestId('profile-video-order-discussed').click()
  await expect(cards(page).first()).toContainText(nth(12))

  await page.getByTestId('profile-video-order-old').click()
  await expect(cards(page).first()).toContainText(nth(21))
  await expect(page.getByTestId('profile-video-capped')).toContainText('20 первых')

  await page.getByTestId('profile-video-order-new').click()
  await expect(page).not.toHaveURL(/sort=/)
  await ready(page)
  await expect(page.getByTestId('profile-video-capped')).toHaveCount(0)
})

test('тема: только ролики с меткой, и с порядком тоже', async ({ page }) => {
  await useMockNode(page, DATA)
  await openVideos(page)
  await ready(page)
  await page.getByTestId('profile-video-tag').click()
  await page.locator('.ant-select-item-option', { hasText: '#music' }).click()
  await expect(page).toHaveURL(/tag=music/)
  await expect(cards(page)).toHaveCount(7)
  await expect(cards(page).first()).toContainText(nth(3))
  await page.getByTestId('profile-video-order-old').click()
  await expect(cards(page).first()).toContainText(nth(21))
  await expect(page.getByTestId('profile-video-capped')).toHaveCount(0)
})

test('ссылка с порядком и темой открывает ту же выдачу', async ({ page }) => {
  await useMockNode(page, DATA)
  await openVideos(page, '&sort=old&tag=music')
  await expect(cards(page).first()).toContainText(nth(21), { timeout: 30_000 })
  await expect(cards(page)).toHaveCount(7)
  await expect(page.getByTestId('profile-video-order-old')).toHaveAttribute('aria-pressed', 'true')
})
