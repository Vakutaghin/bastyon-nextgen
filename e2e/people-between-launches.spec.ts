import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Ники и аватарки между запусками. Первый запуск — с сетью: лента, под постом
 * последний комментарий (нода присылает его без профиля автора — имя
 * догружается отдельно). Второй запуск — без связи с Bastyon и без сервера
 * картинок: лента из сохранённой, а подписи и аватарки должны быть те же —
 * ник автора комментария, а не короткий адрес, и аватарки из превью на
 * устройстве, без единого запроса картинки.
 *
 * Сервер картинок подменён: отвечает как настоящий (`Cache-Control:
 * max-age=0`, CORS разрешён), пока `images` не выключен. Числа — в выводе
 * теста (`[people]`).
 */

const BOB = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = 'PJFaWLSPKfRDe4m8gsXg4zfigcVA5yZU2B'
const BOB_AVATAR = 'https://pocketnet.app:8092/i/bob-avatar.png'
const ALICE_AVATAR = 'https://pocketnet.app:8092/i/alice-avatar.png'
const APP_VERSION = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
  .version
const PNG = readFileSync('public/img/icon-192.png')
const PROXY = /\.pocketnet\.app:8899\//
const IMAGES = /pocketnet\.app:8092\/i\//

function makeData(): MockNodeData {
  return {
    profiles: [
      { address: BOB, name: 'bob_ng', avatar: BOB_AVATAR },
      { address: ALICE, name: 'alice_ng', avatar: ALICE_AVATAR },
    ],
    posts: Array.from({ length: 5 }, (_, i) => ({
      txid: 'b' + String(i).padStart(63, '0'),
      address: BOB,
      message: `Пост ${String(i + 1).padStart(2, '0')}`,
      ago: 600 * (i + 1),
      comments: i === 0 ? 1 : 0,
      ...(i === 0 ? { lastComment: 'c1' } : {}),
    })),
    comments: [
      { id: 'c1', postid: 'b' + '0'.padStart(63, '0'), address: ALICE, message: 'Привет от Алисы' },
    ],
  }
}

async function setUp(page: Page) {
  const state = { node: true, images: true }
  const imageHits: string[] = []
  await useMockNode(page, makeData())
  // Позже зарегистрированные правила срабатывают первыми.
  await page
    .context()
    .route(PROXY, (route) => (state.node ? route.fallback() : route.abort('connectionrefused')))
  await page.context().route(IMAGES, async (route) => {
    imageHits.push(route.request().url())
    if (!state.images) return route.abort('connectionrefused')
    await route.fulfill({
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=0',
        'Content-Type': 'image/png',
      },
      body: PNG,
    })
  })
  await page.addInitScript((version) => {
    localStorage.setItem('bastyon_locale', 'ru')
    localStorage.setItem('bastyonChangelogLastSeenVersion', version)
  }, APP_VERSION)
  return { state, imageHits }
}

/** Ключи строк таблицы настроек локальной базы. */
function settingsKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const open = indexedDB.open('BastyonDB')
        open.onsuccess = () => {
          const db = open.result
          const req = db.transaction('settings').objectStore('settings').getAllKeys()
          req.onsuccess = () => {
            db.close()
            resolve(req.result.map(String))
          }
          req.onerror = () => resolve([])
        }
        open.onerror = () => resolve([])
      })
  )
}

function report(name: string, data: Record<string, unknown>): void {
  process.stdout.write(`[people] ${name} ${JSON.stringify(data)}\n`)
}

test('ники и аватарки второго запуска — с устройства, без сети и без запросов картинок', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1400, height: 900 })
  const { state, imageHits } = await setUp(page)

  // Первый запуск: всё из сети.
  await page.goto('/')
  const firstPost = page.locator('.post-card', { hasText: 'Пост 01' })
  await expect(firstPost).toBeVisible({ timeout: 90_000 })
  await expect(firstPost.getByText('alice_ng').first()).toBeVisible({ timeout: 15_000 })
  // Картинки пришли из сети (с них снимаются превью; небольшая аватарка
  // тут же переходит на превью — src становится data:).
  await expect
    .poll(() => imageHits.includes(BOB_AVATAR) && imageHits.includes(ALICE_AVATAR))
    .toBe(true)
  // Имена и превью уходят на диск пачкой (5 и 2 с) — ждём их там.
  await expect
    .poll(
      async () => {
        const keys = await settingsKeys(page)
        return {
          alice: keys.includes(`known-user:${ALICE}`),
          thumbs: keys.filter((k) => k.startsWith('avatar-thumb:')).length,
          feed: keys.some((k) => k.startsWith('feed-snapshot:') && k !== 'feed-snapshot:index'),
        }
      },
      { timeout: 20_000 }
    )
    .toEqual({ alice: true, thumbs: 2, feed: true })

  // Второй запуск: Bastyon и картинки не отвечают.
  state.node = false
  state.images = false
  const hitsBefore = imageHits.length
  const startedAt = Date.now()
  await page.reload()
  await expect(firstPost).toBeVisible({ timeout: 60_000 })
  const feedS = (Date.now() - startedAt) / 1000

  const aliceName = firstPost.getByText('alice_ng').first()
  const nameShown = await aliceName.isVisible({ timeout: 5_000 }).catch(() => false)
  const bobAvatar = firstPost.locator('img[src^="data:image/"]').first()
  await expect
    .poll(() => firstPost.locator('img[src^="data:image/"]').count(), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(2)
    .catch(() => {})
  const thumbs = await firstPost.locator('img[src^="data:image/"]').count()
  const shortAddress = await firstPost.getByText(`${ALICE.slice(0, 8)}…`).count()
  const imageRequests = imageHits.length - hitsBefore

  report('second launch offline', { feedS, nameShown, thumbs, shortAddress, imageRequests })

  expect(nameShown).toBe(true)
  expect(shortAddress).toBe(0)
  await expect(bobAvatar).toBeVisible()
  // Автор поста и автор комментария — оба из превью.
  expect(thumbs).toBeGreaterThanOrEqual(2)
  // Превью заменяет картинку: сервер картинок не спрашивается вовсе.
  expect(imageRequests).toBe(0)
})
