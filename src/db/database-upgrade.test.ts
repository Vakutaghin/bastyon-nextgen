// v6: сжатые копии видео больше не храним — таблица уходит вместе с
// содержимым (у кого-то до 500 МБ), остальные данные остаются.
// v7: таблицы сохранённой на устройстве переписки.

import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

import { AppDatabase } from './database'

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
