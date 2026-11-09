// Настройки уведомлений по аккаунтам (N25/Р5) поверх настоящей Dexie
// (fake-indexeddb): смена аккаунта не показывает чужие настройки, legacy-ключ
// переезжает к первому аккаунту, битые значения и сбои базы не ломают стор.

import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const auth = vi.hoisted(() => ({ address: null as string | null, broken: false }))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => {
    if (auth.broken) throw new Error('pinia not ready')
    return { getUserAddress: auth.address }
  },
}))

import { db, resetDbAvailabilityForTests } from '@/db/database'
import { settingsAPI } from '@/db/apis/settings-api'
import {
  NOTIFICATION_FILTERS_KEY,
  useNotificationSettingsStore,
  type NotificationFilterKey,
} from './notification-settings-store'

const PA = 'PAccountAaaaaaaaaaaaaaaaaaaaaaaaaa'
const PB = 'PAccountBbbbbbbbbbbbbbbbbbbbbbbbbb'

/** «Перезапуск приложения»: свежая pinia, стор загружается из IDB. */
async function freshStore(address: string | null) {
  auth.address = address
  setActivePinia(createPinia())
  const store = useNotificationSettingsStore()
  await store.load()
  return store
}

describe('useNotificationSettingsStore', () => {
  beforeEach(async () => {
    auth.address = null
    auth.broken = false
    resetDbAvailabilityForTests()
    await db.settings.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('без сохранённого — дефолты; браузерные уведомления только по согласию', async () => {
    const store = await freshStore(PA)
    expect(store.owner).toBe(PA)
    expect(store.getFilter('browserNotif')).toBe(false)
    expect(store.getFilter('sound')).toBe(true)
  })

  it('изменение сохраняется сразу и переживает перезапуск', async () => {
    const store = await freshStore(PA)
    await store.setFilter('sound', false)
    await store.setFilter('browserNotif', true)

    const again = await freshStore(PA)
    expect(again.getFilter('sound')).toBe(false)
    expect(again.getFilter('browserNotif')).toBe(true)
    expect(await settingsAPI.get(`${NOTIFICATION_FILTERS_KEY}:${PA}`)).toMatchObject({
      sound: false,
      browserNotif: true,
    })
  })

  it('смена аккаунта: настройки прежнего не видны новому и возвращаются при обратной смене', async () => {
    const store = await freshStore(PA)
    await store.setFilter('upvotes', false)
    await store.setFilter('browserNotif', true)

    auth.address = PB
    await store.load()
    expect(store.owner).toBe(PB)
    expect(store.getFilter('upvotes')).toBe(true)
    expect(store.getFilter('browserNotif')).toBe(false)
    await store.setFilter('comments', false)

    auth.address = PA
    await store.load()
    expect(store.getFilter('upvotes')).toBe(false)
    expect(store.getFilter('browserNotif')).toBe(true)
    expect(store.getFilter('comments')).toBe(true)
  })

  it('legacy-настройки «на устройство» переезжают к первому аккаунту, второму не достаются', async () => {
    await settingsAPI.set(NOTIFICATION_FILTERS_KEY, { sound: false, followers: false })

    const a = await freshStore(PA)
    expect(a.getFilter('sound')).toBe(false)
    expect(a.getFilter('followers')).toBe(false)
    expect(await settingsAPI.get(NOTIFICATION_FILTERS_KEY)).toBeUndefined()

    const b = await freshStore(PB)
    expect(b.getFilter('sound')).toBe(true)
    expect(b.getFilter('followers')).toBe(true)
  })

  it('гость пишет в общий ключ (его и подхватит первый вошедший)', async () => {
    const guest = await freshStore(null)
    expect(guest.owner).toBeNull()
    await guest.setFilter('sound', false)
    expect(await settingsAPI.get(NOTIFICATION_FILTERS_KEY)).toMatchObject({ sound: false })
  })

  it('auth-store недоступен — стор работает как гость, а не падает', async () => {
    auth.broken = true
    const store = await freshStore(PA)
    expect(store.owner).toBeNull()
    await store.setFilter('win', false)
    expect(await settingsAPI.get(NOTIFICATION_FILTERS_KEY)).toMatchObject({ win: false })
  })

  it('битые значения в сохранённом игнорируются, посторонние ключи не попадают в стор', async () => {
    await settingsAPI.set(`${NOTIFICATION_FILTERS_KEY}:${PA}`, {
      sound: 'no',
      upvotes: false,
      owner: 'PEvil',
      injected: true,
    })
    const store = await freshStore(PA)
    expect(store.getFilter('sound')).toBe(true)
    expect(store.getFilter('upvotes')).toBe(false)
    expect(store.owner).toBe(PA)
    expect(store.$state).not.toHaveProperty('injected')
  })

  it('вместо объекта в базе мусор — дефолты', async () => {
    await settingsAPI.set(`${NOTIFICATION_FILTERS_KEY}:${PA}`, 'garbage')
    const store = await freshStore(PA)
    expect(store.getFilter('downvotes')).toBe(false)
    expect(store.getFilter('sound')).toBe(true)
  })

  it('неизвестный ключ не пишется ни в стор, ни в базу', async () => {
    const store = await freshStore(PA)
    const set = vi.spyOn(settingsAPI, 'set')
    await store.setFilter('owner' as NotificationFilterKey, true)
    await store.setFilter('bogus' as NotificationFilterKey, true)
    expect(set).not.toHaveBeenCalled()
    expect(store.owner).toBe(PA)
    expect(store.$state).not.toHaveProperty('bogus')
  })

  it('сбой чтения при смене аккаунта — дефолты, а не настройки прежнего', async () => {
    const store = await freshStore(PA)
    await store.setFilter('browserNotif', true)

    vi.spyOn(settingsAPI, 'get').mockRejectedValue(new Error('IDB gone'))
    auth.address = PB
    await expect(store.load()).resolves.toBeUndefined()
    expect(store.getFilter('browserNotif')).toBe(false)
  })

  it('сбой записи — значение в памяти применено, исключения нет', async () => {
    const store = await freshStore(PA)
    vi.spyOn(settingsAPI, 'set').mockRejectedValue(new Error('QuotaExceededError'))
    await expect(store.setFilter('sound', false)).resolves.toBeUndefined()
    expect(store.getFilter('sound')).toBe(false)
  })
})
