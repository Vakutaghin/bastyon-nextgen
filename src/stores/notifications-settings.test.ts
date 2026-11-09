// Персист уведомлений в IDB settings (настоящая Dexie поверх fake-indexeddb):
// указатель «прочитано до», отдельный курсор фетча (V38) и скрытые id —
// по адресам, без утечек между аккаунтами; битые записи и сбои базы не роняют опрос.

import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, resetDbAvailabilityForTests } from '@/db/database'
import { settingsAPI } from '@/db/apis/settings-api'
import {
  NOTIFICATIONS_FETCH_BLOCK_KEY,
  NOTIFICATIONS_HIDDEN_IDS_KEY,
  NOTIFICATIONS_LAST_BLOCK_KEY,
} from './notifications-constants'
import {
  loadFetchBlockFromSettings,
  loadHiddenIdsFromSettings,
  loadLastBlockFromSettings,
  saveFetchBlockToSettings,
  saveHiddenIdsToSettings,
  saveLastBlockToSettings,
} from './notifications-settings'

const PA = 'PAccountAaaaaaaaaaaaaaaaaaaaaaaaaa'
const PB = 'PAccountBbbbbbbbbbbbbbbbbbbbbbbbbb'

describe('notifications-settings', () => {
  beforeEach(async () => {
    resetDbAvailabilityForTests()
    await db.settings.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe.each([
    [
      'указатель «прочитано до»',
      NOTIFICATIONS_LAST_BLOCK_KEY,
      loadLastBlockFromSettings,
      saveLastBlockToSettings,
    ],
    [
      'курсор фетча',
      NOTIFICATIONS_FETCH_BLOCK_KEY,
      loadFetchBlockFromSettings,
      saveFetchBlockToSettings,
    ],
  ])('%s', (_label, key, load, save) => {
    it('нет записи — null (опрос начнёт с головы сети)', async () => {
      expect(await load(PA)).toBeNull()
    })

    it('сохранённый блок читается обратно; у каждого аккаунта свой', async () => {
      await save(PA, 100)
      await save(PB, 200)
      await save(PA, 150)
      expect(await load(PA)).toBe(150)
      expect(await load(PB)).toBe(200)
    })

    it.each([
      ['строка вместо объекта', 'garbage'],
      ['блок строкой', { [PA]: '100' }],
      ['null', null],
    ])('битая запись (%s) — null, а не мусорный блок', async (_l, raw) => {
      await settingsAPI.set(key, raw)
      expect(await load(PA)).toBeNull()
    })

    it('запись поверх битой — восстанавливает валидную структуру', async () => {
      await settingsAPI.set(key, 'garbage')
      await save(PA, 7)
      expect(await settingsAPI.get(key)).toEqual({ [PA]: 7 })
      expect(await load(PA)).toBe(7)
    })

    it('чтение бросило — null; запись бросила — без исключения', async () => {
      vi.spyOn(settingsAPI, 'get').mockRejectedValue(new Error('IDB gone'))
      expect(await load(PA)).toBeNull()
      await expect(save(PA, 1)).resolves.toBeUndefined()
      vi.mocked(settingsAPI.get).mockResolvedValue(undefined)
      vi.spyOn(settingsAPI, 'set').mockRejectedValue(new Error('QuotaExceededError'))
      await expect(save(PA, 1)).resolves.toBeUndefined()
    })
  })

  it('записи для разных аккаунтов одновременно не теряют друг друга', async () => {
    // Опрос старого аккаунта ещё пишет курсор, а уже вошли в другой.
    await Promise.all([
      saveFetchBlockToSettings(PA, 1),
      saveFetchBlockToSettings(PB, 2),
      saveLastBlockToSettings(PA, 10),
      saveLastBlockToSettings(PB, 20),
      saveHiddenIdsToSettings(PA, new Set(['a'])),
      saveHiddenIdsToSettings(PB, new Set(['b'])),
    ])
    expect(await loadFetchBlockFromSettings(PA)).toBe(1)
    expect(await loadFetchBlockFromSettings(PB)).toBe(2)
    expect(await loadLastBlockFromSettings(PA)).toBe(10)
    expect(await loadLastBlockFromSettings(PB)).toBe(20)
    expect([...(await loadHiddenIdsFromSettings(PA))]).toEqual(['a'])
    expect([...(await loadHiddenIdsFromSettings(PB))]).toEqual(['b'])
  })

  it('сбой одной записи не останавливает следующие', async () => {
    vi.spyOn(settingsAPI, 'set').mockRejectedValueOnce(new Error('QuotaExceededError'))
    await Promise.all([saveFetchBlockToSettings(PA, 1), saveFetchBlockToSettings(PB, 2)])
    expect(await loadFetchBlockFromSettings(PA)).toBeNull()
    expect(await loadFetchBlockFromSettings(PB)).toBe(2)
  })

  it('курсор фетча и указатель прочитанного независимы (V38)', async () => {
    await saveFetchBlockToSettings(PA, 500)
    expect(await loadLastBlockFromSettings(PA)).toBeNull()
    await saveLastBlockToSettings(PA, 300)
    expect(await loadFetchBlockFromSettings(PA)).toBe(500)
    expect(await loadLastBlockFromSettings(PA)).toBe(300)
  })

  describe('скрытые уведомления', () => {
    it('нет записи — пустое множество', async () => {
      const ids = await loadHiddenIdsFromSettings(PA)
      expect(ids).toBeInstanceOf(Set)
      expect(ids.size).toBe(0)
    })

    it('скрытые id сохраняются по аккаунту и не видны другому', async () => {
      await saveHiddenIdsToSettings(PA, new Set(['n1', 'n2']))
      await saveHiddenIdsToSettings(PB, new Set(['x']))
      expect([...(await loadHiddenIdsFromSettings(PA))].sort()).toEqual(['n1', 'n2'])
      expect([...(await loadHiddenIdsFromSettings(PB))]).toEqual(['x'])
    })

    it('сохранение заменяет множество целиком (раскрытое снова видно)', async () => {
      await saveHiddenIdsToSettings(PA, new Set(['n1', 'n2']))
      await saveHiddenIdsToSettings(PA, new Set(['n2']))
      expect([...(await loadHiddenIdsFromSettings(PA))]).toEqual(['n2'])
    })

    it.each([
      ['строка вместо объекта', 'garbage'],
      ['объект вместо массива', { [PA]: { n1: true } }],
    ])('битая запись (%s) — пустое множество', async (_l, raw) => {
      await settingsAPI.set(NOTIFICATIONS_HIDDEN_IDS_KEY, raw)
      expect((await loadHiddenIdsFromSettings(PA)).size).toBe(0)
    })

    it('запись поверх битой — валидная структура', async () => {
      await settingsAPI.set(NOTIFICATIONS_HIDDEN_IDS_KEY, 'garbage')
      await saveHiddenIdsToSettings(PA, new Set(['n1']))
      expect(await settingsAPI.get(NOTIFICATIONS_HIDDEN_IDS_KEY)).toEqual({ [PA]: ['n1'] })
    })

    it('сбои базы: чтение — пустое множество, запись — без исключения', async () => {
      vi.spyOn(settingsAPI, 'get').mockRejectedValue(new Error('IDB gone'))
      expect((await loadHiddenIdsFromSettings(PA)).size).toBe(0)
      await expect(saveHiddenIdsToSettings(PA, new Set(['n1']))).resolves.toBeUndefined()
    })
  })
})
