// S14: init уведомлений — один в полёте, ответ прежнего аккаунта после смены
// игнорируется, исключение не оставляет loading=true, reset сохраняет колбэк тостов.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PA' as string | null, isUserAuthenticated: true },
  getAllByAddress: vi.fn(),
  putMany: vi.fn(async () => {}),
  loadLastBlock: vi.fn(async (): Promise<number | null> => 100),
  loadFetchBlock: vi.fn(async (): Promise<number | null> => null),
  saveFetchBlock: vi.fn(async () => {}),
  saveLastBlock: vi.fn(async () => {}),
  deleteMany: vi.fn(async () => {}),
  loadHidden: vi.fn(async () => new Set<string>()),
  fetchMissedInfo: vi.fn(),
}))
vi.mock('@/stores', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/db/apis/notifications-api', () => ({
  notificationsAPI: {
    getAllByAddress: mocks.getAllByAddress,
    putMany: mocks.putMany,
    deleteMany: mocks.deleteMany,
  },
}))
vi.mock('./notifications-settings', () => ({
  loadLastBlockFromSettings: mocks.loadLastBlock,
  saveLastBlockToSettings: mocks.saveLastBlock,
  loadFetchBlockFromSettings: mocks.loadFetchBlock,
  saveFetchBlockToSettings: mocks.saveFetchBlock,
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
import { useNotificationSettingsStore } from './notification-settings-store'

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
    mocks.loadLastBlock.mockReset().mockResolvedValue(100)
    mocks.loadFetchBlock.mockReset().mockResolvedValue(null)
    mocks.saveFetchBlock.mockClear()
    mocks.saveLastBlock.mockClear()
    mocks.deleteMany.mockClear()
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

describe('notifications-store: курсор, снимки, бейдж (V38, V39, S53, S56)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.auth.getUserAddress = 'PA'
    mocks.auth.isUserAuthenticated = true
    mocks.getAllByAddress.mockReset().mockResolvedValue([])
    mocks.putMany.mockClear()
    mocks.loadLastBlock.mockReset().mockResolvedValue(null)
    mocks.loadFetchBlock.mockReset().mockResolvedValue(null)
    mocks.saveFetchBlock.mockClear()
    mocks.deleteMany.mockClear()
    mocks.fetchMissedInfo.mockReset().mockResolvedValue([{ block: 101, contentsLang: {} }])
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('курсор фетча персистится на каждом опросе, а не только при открытии выпадашки (V38)', async () => {
    mocks.loadLastBlock.mockResolvedValue(100)
    mocks.fetchMissedInfo.mockResolvedValueOnce([{ block: 150, contentsLang: {} }, event('n1')])
    const store = useNotificationsStore()
    await store.init()

    expect(mocks.saveFetchBlock).toHaveBeenCalledWith('PA', 150)
    // Read-pointer при этом стоит на месте — уведомление считается непрочитанным.
    expect(store.readBlock).toBeLessThan(150)
    expect(store.unreadCount).toBe(1)
  })

  it('следующий запуск стартует с сохранённого курсора, а не с головы сети (V38)', async () => {
    mocks.loadFetchBlock.mockResolvedValue(140)
    const store = useNotificationsStore()
    await store.init()
    expect(mocks.fetchMissedInfo).toHaveBeenCalledWith('PA', 140)
  })

  it('снимки события переживают пересбор списка из IDB (V39)', async () => {
    mocks.fetchMissedInfo.mockResolvedValueOnce([
      { block: 101, contentsLang: {} },
      {
        mesType: 'comment',
        txid: 'n1',
        time: 1,
        nblock: 101,
        posttxid: 'p1',
        addrFrom: 'PX',
        user: { address: 'PX', name: 'Alice' },
        comment: { id: 'n1', postid: 'p1', msg: 'hello' },
      },
    ])
    const store = useNotificationsStore()
    await store.init()
    const first = store.items[0]!
    expect(store.getEnrichment(first).from?.name).toBe('Alice')

    // Повторный init читает IDB, где снимков нет.
    mocks.getAllByAddress.mockResolvedValue([
      { id: 'n1', nblock: 101, type: 'comment', title: 't', time: 1, shareId: 'p1', from: 'PX' },
    ])
    mocks.fetchMissedInfo.mockResolvedValueOnce([{ block: 102, contentsLang: {} }])
    await store.init({ forceRefresh: true })

    expect(store.getEnrichment(store.items[0]!).from?.name).toBe('Alice')
  })

  it('бейдж считает только непрочитанные и чистит хранилище (S53)', async () => {
    mocks.fetchMissedInfo.mockResolvedValueOnce([
      { block: 105, contentsLang: {} },
      event('n1'),
      { ...event('n2'), nblock: 105 },
    ])
    const store = useNotificationsStore()
    await store.init()
    expect(store.unreadCount).toBe(2)

    await store.persistReadPointer()
    expect(store.unreadCount).toBe(0)
    // Список при этом никуда не делся.
    expect(store.list).toHaveLength(2)
  })

  it('выключенный тумблер убирает тип из списка, а не только из тостов (S56)', async () => {
    mocks.fetchMissedInfo.mockResolvedValueOnce([
      { block: 101, contentsLang: {} },
      event('n1'),
      { mesType: 'upvoteShare', txid: 'n2', time: 1, nblock: 101, posttxid: 'p', upvoteVal: 1 },
    ])
    const store = useNotificationsStore()
    await store.init()

    const settings = useNotificationSettingsStore()
    // Низкие оценки по умолчанию выключены — 1★ в списке и не должно быть.
    expect(store.list.map((n) => n.id)).toEqual(['n1'])

    settings.$patch({ downvotes: true })
    expect(store.list.map((n) => n.id).sort()).toEqual(['n1', 'n2'])

    settings.$patch({ comments: false })
    expect(store.list.map((n) => n.id)).toEqual(['n2'])
  })
})
