// v6: сжатые копии видео больше не храним — таблица уходит вместе с
// содержимым (у кого-то до 500 МБ), остальные данные остаются.
// v7: таблицы сохранённой на устройстве переписки.

import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'

import { settingsAPI } from './apis/settings-api'
import {
  AppDatabase,
  db,
  initDatabase,
  isDbUnavailable,
  resetDbAvailabilityForTests,
} from './database'

describe('обновление базы', () => {
  it('v6 удаляет сжатые копии видео, v7 добавляет переписку, остальное на месте', async () => {
    const old = new Dexie('BastyonDB')
    old.version(5).stores({
      transcodedVideos: 'id, originalFileName, resolution, createdAt',
      postRatingsPending: '++id, shareId, userAddress, expiresAt, status',
      settings: 'key, createdAt',
      favorites: '[address+id], address, addedAt',
      notifications: '[address+id], address, nblock',
      decryptedMessages: '[userId+eventId], userId, createdAt',
      videoProgress: 'id, updatedAt',
      meshDialogs: 'id, account',
      meshMessages: 'id, &dedupKey, [dialogId+ts], account',
    })
    await old.table('transcodedVideos').put({ id: 'video_1', createdAt: 1 })
    await old.table('settings').put({ key: 'theme', value: 'dark', createdAt: 1 })
    old.close()

    const db = new AppDatabase()
    await db.open()
    expect(db.verno).toBe(7)
    const stores = Array.from(db.backendDB().objectStoreNames)
    expect(stores).not.toContain('transcodedVideos')
    expect(stores).toEqual(expect.arrayContaining(['chatArchive', 'chatArchiveChats']))
    expect(await db.settings.get('theme')).toMatchObject({ value: 'dark' })
    db.close()
  })
})

/** База ранней сборки как на диске у пользователя: избранное с ключом `id`, старые кэши видео. */
function legacyDatabase(version: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('BastyonDB', version)
    req.onupgradeneeded = () => {
      const idb = req.result
      const store = (name: string, keyPath: string | string[], indexes: string[] = []) => {
        const s = idb.createObjectStore(name, {
          keyPath,
          autoIncrement: name === 'postRatingsPending',
        })
        indexes.forEach((index) => s.createIndex(index, index))
        return s
      }
      store('videos', 'id', ['url', 'createdAt']).put({ id: 'old', url: 'x', createdAt: 1 })
      store('contentCache', 'key', ['expiresAt', 'createdAt'])
      store('transcodedVideos', 'id', ['createdAt']).put({ id: 'video_1', createdAt: 1 })
      store('postRatingsPending', 'id', ['shareId', 'userAddress', 'expiresAt', 'status'])
      store('settings', 'key', ['createdAt']).put({ key: 'theme', value: 'dark', createdAt: 1 })
      store('favorites', 'id', ['addedAt']).put({ id: 'post1', addedAt: 5 })
      store('notifications', ['address', 'id'], ['address', 'nblock']).put({
        address: 'PA',
        id: 'n1',
        nblock: 1,
      })
      store('decryptedMessages', ['userId', 'eventId'], ['userId', 'createdAt'])
    }
    req.onsuccess = () => {
      req.result.close()
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

// 0.18.0 на macOS: «Локальное хранилище недоступно» и «Что нового» на каждом
// запуске — Dexie не меняет первичный ключ и бросала UpgradeError.
describe('база ранней сборки', () => {
  beforeEach(async () => {
    db.close()
    resetDbAvailabilityForTests()
    await Dexie.delete('BastyonDB')
  })

  it.each([
    ['записана выше v6 (63)', 63],
    ['v2 (избранное ещё по id)', 20],
  ])('%s: пересобирается со строками, база работает', async (_, version) => {
    await legacyDatabase(version)
    const plain = new AppDatabase()
    await expect(plain.open()).rejects.toMatchObject({ name: 'UpgradeError' })
    plain.close()

    await initDatabase()
    expect(isDbUnavailable()).toBe(false)
    expect(db.verno).toBe(7)
    expect(db.favorites.schema.primKey.keyPath).toEqual(['address', 'id'])
    expect(await db.favorites.toArray()).toEqual([{ id: 'post1', addedAt: 5, address: '' }])
    expect(await db.settings.get('theme')).toMatchObject({ value: 'dark' })
    expect(await db.notifications.count()).toBe(1)
    const stores = Array.from(db.backendDB().objectStoreNames)
    expect(stores).not.toContain('videos')
    expect(stores).not.toContain('transcodedVideos')
    expect(stores).toEqual(expect.arrayContaining(['chatArchive', 'chatArchiveChats']))
  })

  it('обращения во время пересборки ждут её, а не выключают кэш', async () => {
    await legacyDatabase(63)
    const init = initDatabase()
    const theme = settingsAPI.get('theme')
    await init
    expect(await theme).toBe('dark')
    expect(isDbUnavailable()).toBe(false)
  })
})
