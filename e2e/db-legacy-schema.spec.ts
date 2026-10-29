import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { useMockNode } from './support/mock-node'

/**
 * База ранней сборки — как на диске у пользователя macOS: избранное с ключом
 * `id`, старые кэши видео, версия 63. С 0.18.0 Dexie бросала на ней
 * UpgradeError: «Локальное хранилище недоступно» и «Что нового» на каждом
 * запуске. Теперь база пересобирается со строками.
 */

const VERSION = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version

test('база ранней сборки открывается, строки на месте', async ({ page }) => {
  test.setTimeout(90_000)
  await useMockNode(page, { profiles: [], posts: [], comments: [] })

  // Тот же origin, но без приложения: базу кладём до того, как его код её откроет.
  await page.goto('/manifest.webmanifest')
  await page.evaluate(
    (version) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('BastyonDB', 63)
        req.onupgradeneeded = () => {
          const idb = req.result
          const store = (name: string, keyPath: string | string[], indexes: string[]) => {
            const s = idb.createObjectStore(name, {
              keyPath,
              autoIncrement: name === 'postRatingsPending',
            })
            indexes.forEach((index) => s.createIndex(index, index))
            return s
          }
          store('videos', 'id', ['url', 'createdAt'])
          store('transcodedVideos', 'id', ['createdAt']).put({ id: 'video_1', createdAt: 1 })
          store('postRatingsPending', 'id', ['shareId', 'userAddress', 'expiresAt', 'status'])
          store('settings', 'key', ['createdAt']).put({
            key: 'bastyonChangelogLastSeenVersion',
            value: version,
            createdAt: 1,
          })
          store('favorites', 'id', ['addedAt']).put({ id: 'post1', addedAt: 5 })
          store('notifications', ['address', 'id'], ['address', 'nblock'])
          store('decryptedMessages', ['userId', 'eventId'], ['userId', 'createdAt'])
        }
        req.onsuccess = () => {
          req.result.close()
          resolve()
        }
        req.onerror = () => reject(req.error)
      }),
    VERSION
  )

  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })

  await expect
    .poll(() =>
      page.evaluate(
        async () => (await indexedDB.databases()).find((d) => d.name === 'BastyonDB')?.version
      )
    )
    .toBe(70)
  const disk = await page.evaluate(
    () =>
      new Promise<{ keyPath: unknown; favorites: unknown[]; stores: string[] }>((resolve) => {
        const req = indexedDB.open('BastyonDB')
        req.onsuccess = () => {
          const idb = req.result
          const fav = idb.transaction('favorites').objectStore('favorites')
          const all = fav.getAll()
          all.onsuccess = () => {
            resolve({
              keyPath: fav.keyPath,
              favorites: all.result,
              stores: Array.from(idb.objectStoreNames),
            })
            idb.close()
          }
        }
      })
  )
  expect(disk.keyPath).toEqual(['address', 'id'])
  expect(disk.favorites).toEqual([{ id: 'post1', addedAt: 5, address: '' }])
  expect(disk.stores).toContain('chatArchive')
  expect(disk.stores).not.toContain('transcodedVideos')

  // Версия «Что нового» пережила пересборку — окно не открывается; тоста нет.
  await page.waitForTimeout(1500)
  await expect(page.getByRole('button', { name: 'Понятно' })).toHaveCount(0)
  await expect(page.getByText('Локальное хранилище недоступно')).toHaveCount(0)
})
