// Локальная база (Dexie поверх fake-indexeddb, та же схема, что в
// приложении): расшифровки чатов не видны другому аккаунту и стираются при
// выходе и удалении аккаунта (V15); избранное — по аккаунтам со
// старыми записями, переехавшими к первому спросившему (N10); «Очистить кэш»
// не трогает избранное, настройки и неотправленные оценки; позиции видео
// не копятся сверх 300; одна pending-оценка на пост (N10); уведомления
// новыми сверху; хранилище транскодированных видео подрезается по числу и
// размеру. Время подменяется только у Date: fake-indexeddb выполняет запросы
// через таймеры, и полная подмена таймеров останавливает базу.

import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { db, resetDbAvailabilityForTests } from '../database'
import type { TranscodedVideo } from '../types'
import { cacheAPI } from './cache-api'
import {
  clearDecryptedForUser,
  clearDecryptedForUserPrefix,
  loadAllDecryptedForUser,
  saveDecrypted,
} from './decrypted-messages-api'
import { favoritesAPI } from './favorites-api'
import { notificationsAPI } from './notifications-api'
import { postRatingPendingAPI } from './post-rating-pending-api'
import { settingsAPI } from './settings-api'
import { transcodedVideoAPI } from './transcoded-video-api'
import { videoProgressAPI } from './video-progress-api'

const texts = (list: Array<{ text: string }>) => list.map((m) => m.text).sort()

describe('локальная база', () => {
  beforeEach(async () => {
    resetDbAvailabilityForTests()
    favoritesAPI.__resetAdopted()
    await Promise.all(db.tables.map((table) => table.clear()))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('расшифровки сообщений', () => {
    it('каждый аккаунт видит только свои; повторная запись того же события заменяет', async () => {
      await saveDecrypted('@aa:srv', '$1', 'привет')
      await saveDecrypted('@aa:srv', '$1', 'привет!')
      await saveDecrypted('@aa:srv', '$2', 'как дела')
      await saveDecrypted('@bb:srv', '$1', 'чужое')
      expect(texts(await loadAllDecryptedForUser('@aa:srv'))).toEqual(['как дела', 'привет!'])
      expect(texts(await loadAllDecryptedForUser('@bb:srv'))).toEqual(['чужое'])
    })

    it('выход стирает только свои; удаление аккаунта — по префиксу на любом сервере (V15)', async () => {
      await saveDecrypted('@aa:srv', '$1', 'a1')
      await saveDecrypted('@aa:other.server', '$2', 'a2')
      await saveDecrypted('@bb:srv', '$3', 'b')

      await clearDecryptedForUser('@aa:srv')
      expect(texts(await loadAllDecryptedForUser('@aa:other.server'))).toEqual(['a2'])

      await clearDecryptedForUserPrefix('@aa:')
      expect(await loadAllDecryptedForUser('@aa:other.server')).toEqual([])
      expect(texts(await loadAllDecryptedForUser('@bb:srv'))).toEqual(['b'])
    })

    it('без пользователя или события ничего не пишет и не читает', async () => {
      await saveDecrypted('', '$1', 'x')
      await saveDecrypted('@aa:srv', '', 'x')
      await clearDecryptedForUserPrefix('')
      expect(await db.decryptedMessages.count()).toBe(0)
      expect(await loadAllDecryptedForUser('')).toEqual([])
    })
  })

  describe('избранное', () => {
    it('по аккаунтам, новые сверху, с пагинацией', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      for (const [i, id] of ['p1', 'p2', 'p3'].entries()) {
        vi.setSystemTime(1_000 + i)
        await favoritesAPI.add('PA', id)
      }
      await favoritesAPI.add('PB', 'p9')
      expect(await favoritesAPI.getAllIds('PA')).toEqual(['p3', 'p2', 'p1'])
      expect((await favoritesAPI.getList('PA', 1, 1)).map((f) => f.id)).toEqual(['p2'])
      expect(await favoritesAPI.has('PB', 'p1')).toBe(false)

      await favoritesAPI.remove('PA', 'p2')
      expect(await favoritesAPI.getAllIds('PA')).toEqual(['p3', 'p1'])
      await favoritesAPI.purge('PA')
      expect(await favoritesAPI.getAllIds('PA')).toEqual([])
      expect(await favoritesAPI.getAllIds('PB')).toEqual(['p9'])
    })

    it('старое избранное без адреса переезжает к первому аккаунту и больше никому (N10)', async () => {
      await db.favorites.put({ address: '', id: 'old', addedAt: 1 })
      expect(await favoritesAPI.has('PA', 'old')).toBe(true)
      expect(await favoritesAPI.getAllIds('PB')).toEqual([])
      expect(await db.favorites.where('address').equals('').count()).toBe(0)
    })
  })

  it('«Очистить кэш» не трогает избранное, настройки и неотправленные оценки', async () => {
    await saveDecrypted('@aa:srv', '$1', 'x')
    await videoProgressAPI.save('v1', 10, 100)
    await notificationsAPI.put('PA', { id: 'n1', nblock: 1 } as never)
    await favoritesAPI.add('PA', 'p1')
    await settingsAPI.set('theme', 'dark')
    await postRatingPendingAPI.addPending({
      shareId: 's',
      userAddress: 'PA',
      ratingValue: 5,
      ttlMs: 60_000,
    })

    expect(await cacheAPI.size()).toBe(3)
    await expect(cacheAPI.clear()).resolves.toEqual({ removed: 3 })
    expect(await cacheAPI.size()).toBe(0)
    expect(await favoritesAPI.getAllIds('PA')).toEqual(['p1'])
    expect(await settingsAPI.get('theme')).toBe('dark')
    expect(await db.postRatingsPending.count()).toBe(1)
  })

  describe('позиции видео', () => {
    it('запоминаются, забываются и не копятся сверх 300 — уходят самые давние', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      await videoProgressAPI.save('v1', 42, 600)
      expect(await videoProgressAPI.get('v1')).toMatchObject({ position: 42, duration: 600 })
      await videoProgressAPI.clear('v1')
      expect(await videoProgressAPI.get('v1')).toBeNull()

      for (let i = 0; i < 302; i++) {
        vi.setSystemTime(10_000 + i)
        await videoProgressAPI.save(`video-${i}`, i, 100)
      }
      expect(await db.videoProgress.count()).toBe(300)
      expect(await videoProgressAPI.get('video-0')).toBeNull()
      expect(await videoProgressAPI.get('video-1')).toBeNull()
      expect(await videoProgressAPI.get('video-301')).not.toBeNull()
    })

    it('без id — ничего', async () => {
      await videoProgressAPI.save('', 1, 2)
      expect(await videoProgressAPI.get('')).toBeNull()
      expect(await db.videoProgress.count()).toBe(0)
    })
  })

  describe('неотправленные оценки', () => {
    it('повторная оценка того же поста заменяет прежнюю, а не копится (N10)', async () => {
      await postRatingPendingAPI.addPending({
        shareId: 's1',
        userAddress: 'PA',
        ratingValue: 3,
        ttlMs: 60_000,
      })
      const second = await postRatingPendingAPI.addPending({
        shareId: 's1',
        userAddress: 'PA',
        ratingValue: 5,
        ttlMs: 60_000,
        postTitle: 'Пост',
      })
      const rows = await db.postRatingsPending.toArray()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        id: second.id,
        ratingValue: 5,
        status: 'pending',
        postTitle: 'Пост',
      })
    })

    it('отправлена → подтверждена удаляет; ошибка остаётся с причиной и выпадает из активных', async () => {
      await postRatingPendingAPI.addPending({
        shareId: 's1',
        userAddress: 'PA',
        ratingValue: 5,
        ttlMs: 60_000,
      })
      await postRatingPendingAPI.addPending({
        shareId: 's2',
        userAddress: 'PA',
        ratingValue: 4,
        ttlMs: 60_000,
      })

      await postRatingPendingAPI.markSubmitted({ shareId: 's1', userAddress: 'PA', txid: 'tx1' })
      expect(await postRatingPendingAPI.getActiveByUser('PA')).toHaveLength(2)

      await postRatingPendingAPI.markFailed({ shareId: 's2', userAddress: 'PA', reason: 'limit' })
      const active = await postRatingPendingAPI.getActiveByUser('PA')
      expect(active.map((r) => [r.shareId, r.status, r.txid])).toEqual([['s1', 'submitted', 'tx1']])
      expect(await db.postRatingsPending.where('shareId').equals('s2').first()).toMatchObject({
        status: 'failed',
        lastError: 'limit',
      })

      await postRatingPendingAPI.markConfirmed({ shareId: 's1', userAddress: 'PA' })
      expect(await postRatingPendingAPI.getActiveByUser('PA')).toEqual([])
      await postRatingPendingAPI.markConfirmed({ shareId: 'unknown', userAddress: 'PA' })
    })

    it('просроченные не активны и вычищаются', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(1_000_000)
      await postRatingPendingAPI.addPending({
        shareId: 's1',
        userAddress: 'PA',
        ratingValue: 5,
        ttlMs: 1_000,
      })
      vi.setSystemTime(1_002_000)
      expect(await postRatingPendingAPI.getActiveByUser('PA')).toEqual([])
      await expect(postRatingPendingAPI.cleanupExpired()).resolves.toBe(1)
      expect(await db.postRatingsPending.count()).toBe(0)
    })
  })

  it('уведомления: по адресу, новые сверху, удаление по одному и пачкой', async () => {
    await notificationsAPI.putMany('PA', [
      { id: 'n1', nblock: 10 },
      { id: 'n2', nblock: 30 },
      { id: 'n3', nblock: 20 },
    ] as never)
    await notificationsAPI.put('PB', { id: 'n1', nblock: 99 } as never)
    expect((await notificationsAPI.getAllByAddress('PA')).map((n) => n.id)).toEqual([
      'n2',
      'n3',
      'n1',
    ])

    await notificationsAPI.delete('PA', 'n2')
    await notificationsAPI.deleteMany('PA', ['n3'])
    await notificationsAPI.deleteMany('PA', [])
    expect((await notificationsAPI.getAllByAddress('PA')).map((n) => n.id)).toEqual(['n1'])

    await notificationsAPI.deleteAllByAddress('PA')
    expect(await notificationsAPI.getAllByAddress('PA')).toEqual([])
    expect(await notificationsAPI.getAllByAddress('PB')).toHaveLength(1)
  })

  describe('транскодированные видео', () => {
    const video = (
      id: string,
      sizeMB: number
    ): Omit<TranscodedVideo, 'createdAt' | 'updatedAt'> => ({
      id,
      originalFileName: `${id}.mov`,
      originalSize: 1,
      transcodedBlob: { size: sizeMB * 1024 * 1024 } as Blob,
      resolution: '720p',
      bitrate: 2000,
      hasAudio: true,
      duration: 10,
      width: 1280,
      height: 720,
      mimeType: 'video/mp4',
    })

    async function saveAt(time: number, id: string, sizeMB: number) {
      vi.setSystemTime(time)
      await transcodedVideoAPI.save(video(id, sizeMB))
    }

    beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))

    it('новые первыми; статистика размера', async () => {
      await saveAt(1_000, 'a', 1)
      await saveAt(2_000, 'b', 3)
      expect((await transcodedVideoAPI.getRecent()).map((v) => v.id)).toEqual(['b', 'a'])
      expect((await transcodedVideoAPI.getRecent(1)).map((v) => v.id)).toEqual(['b'])
      expect(await transcodedVideoAPI.getStorageStats()).toMatchObject({
        count: 2,
        totalSizeMB: 4,
        averageSizeMB: 2,
      })
    })

    it('лимит по числу и по размеру удаляет самые старые', async () => {
      await saveAt(1_000, 'a', 2)
      await saveAt(2_000, 'b', 2)
      await saveAt(3_000, 'c', 2)
      await expect(transcodedVideoAPI.enforceLimit(2)).resolves.toBe(1)
      expect(await transcodedVideoAPI.get('a')).toBeUndefined()

      await expect(transcodedVideoAPI.enforceSizeLimit(3)).resolves.toBe(1)
      expect((await transcodedVideoAPI.getAll()).map((v) => v.id)).toEqual(['c'])
      await expect(transcodedVideoAPI.enforceSizeLimit(3)).resolves.toBe(0)
    })

    it('старше N дней удаляются; удаление несуществующего — без ошибки', async () => {
      const day = 24 * 60 * 60 * 1000
      await saveAt(0, 'old', 1)
      await saveAt(40 * day, 'fresh', 1)
      vi.setSystemTime(41 * day)
      await expect(transcodedVideoAPI.deleteOld(30)).resolves.toBe(1)
      await transcodedVideoAPI.delete('missing')
      await transcodedVideoAPI.delete('fresh')
      expect(await transcodedVideoAPI.count()).toBe(0)
    })
  })
})
