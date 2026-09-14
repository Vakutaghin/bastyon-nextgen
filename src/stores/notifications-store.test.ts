// S14: init уведомлений — один в полёте, ответ прежнего аккаунта после смены
// игнорируется, исключение не оставляет loading=true, reset сохраняет колбэк тостов.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PA' as string | null, isUserAuthenticated: true },
  getAllByAddress: vi.fn(),
  putMany: vi.fn(async () => {}),
  loadLastBlock: vi.fn(async () => 100),
  loadHidden: vi.fn(async () => new Set<string>()),
  fetchMissedInfo: vi.fn(),
}))
vi.mock('@/stores', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/db/apis/notifications-api', () => ({
  notificationsAPI: { getAllByAddress: mocks.getAllByAddress, putMany: mocks.putMany },
}))
vi.mock('./notifications-settings', () => ({
  loadLastBlockFromSettings: mocks.loadLastBlock,
  saveLastBlockToSettings: vi.fn(),
  loadHiddenIdsFromSettings: mocks.loadHidden,
  saveHiddenIdsToSettings: vi.fn(),
}))
vi.mock('./notifications-fetch', () => ({
  fetchCurrentBlockHeight: vi.fn(async () => 100),
  isTimeoutError: () => false,
  fetchMissedInfo: mocks.fetchMissedInfo,
}))
vi.mock('./notifications-enricher', () => ({ enrichNotifications: vi.fn() }))

import { useNotificationsStore } from './notifications-store'

const event = (id: string) => ({
  mesType: 'comment',
  txid: id,
  addr: 'PX',
  time: 1,
  nblock: 101,
  posttxid: 'p',
})

describe('notifications-store init (S14)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.auth.getUserAddress = 'PA'
    mocks.auth.isUserAuthenticated = true
    mocks.getAllByAddress.mockReset().mockResolvedValue([])
    mocks.putMany.mockClear()
    mocks.fetchMissedInfo.mockReset().mockResolvedValue([{ block: 101, contentsLang: {} }])
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('ответ getmissedinfo для A после смены на B не попадает в items', async () => {
    let release: (v: unknown[]) => void = () => {}
    mocks.fetchMissedInfo.mockImplementationOnce(() => new Promise((r) => (release = r)))
    const store = useNotificationsStore()
    const p = store.init()
    await new Promise((r) => setTimeout(r, 0))

    // Смена аккаунта: сброс + новый адрес.
    store.reset()
    mocks.auth.getUserAddress = 'PB'
    release([{ block: 101, contentsLang: {} }, event('n-from-A')])
    await p

    expect(store.items).toEqual([])
    expect(store.initedForAddress).toBeNull()
    expect(store.loading).toBe(false)
    expect(mocks.putMany).not.toHaveBeenCalled()
  })

  it('параллельный init не запускается, пока первый в полёте', async () => {
    let release: (v: unknown[]) => void = () => {}
    mocks.fetchMissedInfo.mockImplementationOnce(() => new Promise((r) => (release = r)))
    const store = useNotificationsStore()
    const p1 = store.init()
    await new Promise((r) => setTimeout(r, 0))
    const p2 = store.init({ forceRefresh: true })
    release([{ block: 101, contentsLang: {} }, event('n1')])
    await Promise.all([p1, p2])
    expect(mocks.fetchMissedInfo).toHaveBeenCalledTimes(1)
    expect(store.items.map((i) => i.id)).toEqual(['n1'])
    expect(store.loading).toBe(false)
  })

  it('исключение из IDB не оставляет loading=true и позволяет повторить', async () => {
    mocks.getAllByAddress.mockRejectedValueOnce(new Error('idb closed'))
    const store = useNotificationsStore()
    await store.init()
    expect(store.loading).toBe(false)
    expect(store.inited).toBe(false)
    await store.init()
    expect(store.inited).toBe(true)
  })

  it('reset() сохраняет колбэк тостов (ставится один раз на буте)', () => {
    const store = useNotificationsStore()
    const cb = vi.fn()
    store.setOnNewNotifications(cb)
    store.reset()
    expect(store.onNewNotifications).toBe(cb)
  })
})
