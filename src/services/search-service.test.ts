// Поиск по ноде: запрос чистится от знаков, но буквы любого языка
// интерфейса остаются (раньше китайский и корейский запрос становился
// пустым, а у немецкого и сербского выпадали буквы, в русском — «ё»);
// параметры searchusers/search как у старого клиента; теги раскодируются;
// высота блока для стабильной пагинации кешируется на 30 с и не
// запрашивается дважды одновременно. Адрес или публичный ключ аккаунта
// ищется не по имени, а профилем по адресу: searchusers на адрес пуст.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpcCall: vi.fn(), getByPRC: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({ rpcCall: mocks.rpcCall, getByPRC: mocks.getByPRC }))

import {
  __resetBlockHeightCache,
  accountAddressOf,
  getCurrentBlockHeight,
  sanitizeSearchQuery,
  searchPosts,
  searchTags,
  searchUsers,
} from './search-service'

describe('sanitizeSearchQuery', () => {
  it.each([
    ['ёлка и Ёжик', 'ёлка и Ёжик'],
    ['Müller Straße', 'Müller Straße'],
    ['café crème', 'café crème'],
    ['año niño', 'año niño'],
    ['Ђорђе Џаја', 'Ђорђе Џаја'],
    ['비트코인', '비트코인'],
    ['比特币', '比特币'],
    ['#pkoin_news 2026', '#pkoin_news 2026'],
  ])('буквы любого языка остаются: %s', (input, expected) => {
    expect(sanitizeSearchQuery(input)).toBe(expected)
  })

  it('знаки, эмодзи и разметка убираются, края обрезаются', () => {
    expect(sanitizeSearchQuery('  <script>alert("x")</script> 🚀 %20 ')).toBe(
      'scriptalertxscript  20'
    )
    expect(sanitizeSearchQuery('!!!')).toBe('')
  })

  it('разложенная диакритика собирается в одну букву', () => {
    expect(sanitizeSearchQuery('café')).toBe('café')
  })
})

describe('поиск', () => {
  beforeEach(() => {
    mocks.rpcCall.mockReset()
    mocks.getByPRC.mockReset()
    __resetBlockHeightCache()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('пользователи: searchusers [запрос, users, блок, начало, сколько]', async () => {
    mocks.rpcCall.mockResolvedValue([{ address: 'PBob', name: 'bob' }])
    await expect(
      searchUsers('bob!', { start: 10, count: 5, fixedBlock: 3_000_000 })
    ).resolves.toEqual([{ address: 'PBob', name: 'bob' }])
    expect(mocks.rpcCall).toHaveBeenCalledWith({
      method: 'searchusers',
      parameters: ['bob', 'users', 3_000_000, 10, 5],
      options: { auth: false },
    })
  })

  it('посты: search [.., posts, ..] и ответ из posts.data', async () => {
    mocks.rpcCall.mockResolvedValue({ posts: { data: [{ txid: 'p1' }] } })
    await expect(searchPosts('比特币')).resolves.toEqual([{ txid: 'p1' }])
    expect(mocks.rpcCall.mock.lastCall![0].parameters).toEqual(['比特币', 'posts', 0, 0, 10])

    mocks.rpcCall.mockResolvedValue({})
    await expect(searchPosts('x y')).resolves.toEqual([])
  })

  it('теги раскодируются дважды; нераскодируемый тег остаётся как есть; пустые отбрасываются', async () => {
    mocks.rpcCall.mockResolvedValue({
      tags: {
        data: [
          { tag: encodeURIComponent(encodeURIComponent('новости')), count: 5 },
          { tag: '%E0%A4%A', count: 1 },
          { tag: '', count: 9 },
        ],
      },
    })
    await expect(searchTags('нов')).resolves.toEqual([
      { tag: 'новости', count: 5 },
      { tag: '%E0%A4%A', count: 1 },
    ])
  })

  it('запрос из одних знаков в сеть не уходит', async () => {
    await expect(searchUsers('!!!')).resolves.toEqual([])
    await expect(searchPosts('   ')).resolves.toEqual([])
    await expect(searchTags('%%')).resolves.toEqual([])
    expect(mocks.rpcCall).not.toHaveBeenCalled()
  })

  it('адрес аккаунта: лёгкий профиль по адресу вместо поиска по имени', async () => {
    const ADDRESS = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
    mocks.rpcCall.mockResolvedValue([{ address: ADDRESS, name: 'alice', reputation: 12 }])
    await expect(searchUsers(` ${ADDRESS} `, { count: 5 })).resolves.toEqual([
      { address: ADDRESS, name: 'alice', reputation: 12 },
    ])
    expect(mocks.rpcCall).toHaveBeenCalledWith({
      method: 'getuserprofile',
      parameters: [[ADDRESS], '1'],
      options: { auth: false },
    })

    // Вторая страница «Показать ещё» — без повтора; адрес без аккаунта — пусто.
    await expect(searchUsers(ADDRESS, { start: 10 })).resolves.toEqual([])
    mocks.rpcCall.mockResolvedValue([])
    await expect(searchUsers(ADDRESS)).resolves.toEqual([])
    expect(mocks.rpcCall).toHaveBeenCalledTimes(2)
  })

  it('публичный ключ — тот же аккаунт, что и его адрес', async () => {
    // Векторы из key-generation.test.ts: ключ и адрес одной мнемоники.
    const KEY = '03538bedd425db67b3f68b1152235b56e4d938284dc31bb72648c2079b00f6101f'
    expect(accountAddressOf(KEY)).toBe('PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy')
    expect(accountAddressOf(KEY.toUpperCase())).toBe('PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy')
    expect(
      accountAddressOf('0265ae8ea93a32806d04c1d576353851d0fa0110ad5c3817a8d8aa898389f7f3c3')
    ).toBe('PUUAaAByj6BEey5CSYxJoGXr1KishVyC3A')

    mocks.rpcCall.mockResolvedValue([{ address: 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy' }])
    await searchUsers(KEY)
    expect(mocks.rpcCall.mock.lastCall![0].parameters).toEqual([
      ['PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'],
      '1',
    ])
  })

  it('не адрес и не ключ — поиск по имени', () => {
    expect(accountAddressOf('bob')).toBeNull()
    // Опечатка в адресе: контрольная сумма не сходится.
    expect(accountAddressOf('PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPz')).toBeNull()
    // Биткоин-адрес — чужая сеть.
    expect(accountAddressOf('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBeNull()
    // Хеш блока или транзакции (64 hex) — не ключ.
    expect(accountAddressOf('a'.repeat(64))).toBeNull()
  })

  it('пользователи: не массив в ответе — пустой список', async () => {
    mocks.rpcCall.mockResolvedValue({ result: 'success' })
    await expect(searchUsers('bob')).resolves.toEqual([])
  })

  describe('getCurrentBlockHeight', () => {
    it('высота из getnodeinfo кешируется на 30 с', async () => {
      vi.useFakeTimers()
      mocks.getByPRC.mockResolvedValue({ data: { lastblock: { height: 3_100_000 } } })
      await expect(getCurrentBlockHeight()).resolves.toBe(3_100_000)
      await getCurrentBlockHeight()
      expect(mocks.getByPRC).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(30_000)
      mocks.getByPRC.mockResolvedValue({ lastblock: { height: 3_100_001 } })
      await expect(getCurrentBlockHeight()).resolves.toBe(3_100_001)
      expect(mocks.getByPRC).toHaveBeenCalledTimes(2)
    })

    it('одновременные вызовы делят один запрос', async () => {
      mocks.getByPRC.mockResolvedValue({ data: { lastblock: { height: 7 } } })
      const [a, b] = await Promise.all([getCurrentBlockHeight(), getCurrentBlockHeight()])
      expect([a, b]).toEqual([7, 7])
      expect(mocks.getByPRC).toHaveBeenCalledTimes(1)
    })

    it('нода не ответила — прежнее значение, а без него null (пагинация без фиксации)', async () => {
      vi.useFakeTimers()
      mocks.getByPRC.mockRejectedValueOnce(new Error('offline'))
      await expect(getCurrentBlockHeight()).resolves.toBeNull()

      mocks.getByPRC.mockResolvedValueOnce({ data: { lastblock: { height: 5 } } })
      await getCurrentBlockHeight()
      vi.advanceTimersByTime(31_000)
      mocks.getByPRC.mockResolvedValueOnce({ data: { lastblock: { height: 0 } } })
      await expect(getCurrentBlockHeight()).resolves.toBe(5)
    })
  })
})
