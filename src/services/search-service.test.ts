// Поиск по ноде: запрос чистится от знаков, но буквы любого языка
// интерфейса остаются (раньше китайский и корейский запрос становился
// пустым, а у немецкого и сербского выпадали буквы, в русском — «ё»);
// параметры searchusers/search как у старого клиента; теги раскодируются;
// высота блока для стабильной пагинации кешируется на 30 с и не
// запрашивается дважды одновременно.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpcCall: vi.fn(), getByPRC: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({ rpcCall: mocks.rpcCall, getByPRC: mocks.getByPRC }))

import {
  __resetBlockHeightCache,
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
