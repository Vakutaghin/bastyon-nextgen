// Поиск по постам профиля: только посты автора, страницы на одном блоке,
// новый запрос начинает выдачу заново, а ответ на прежний её не портит.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  searchPosts: vi.fn(),
  height: vi.fn(async () => 3_000_000 as number | null),
}))

vi.mock('@/services/search-service', async (original) => ({
  ...(await original<typeof import('@/services/search-service')>()),
  searchPosts: mocks.searchPosts,
  getCurrentBlockHeight: mocks.height,
}))

import { PROFILE_SEARCH_PAGE, useProfilePostSearch } from './use-profile-post-search'

const flush = () => new Promise((r) => setTimeout(r, 0))

function found(n: number, author = 'PAuthor', from = 0) {
  return Array.from({ length: n }, (_, i) => ({
    txid: `t${from + i}`,
    hash: `t${from + i}`,
    address: author,
    m: `post ${from + i}`,
    time: 1,
  }))
}

beforeEach(() => vi.clearAllMocks())

describe('useProfilePostSearch', () => {
  it('без слов поиска не ищет', async () => {
    const search = useProfilePostSearch(
      () => 'PAuthor',
      () => '  !!  '
    )
    await flush()
    expect(search.active.value).toBe(false)
    expect(mocks.searchPosts).not.toHaveBeenCalled()
  })

  it('ищет у автора, листает с того же блока, чужие посты отбрасывает', async () => {
    mocks.searchPosts
      .mockResolvedValueOnce([...found(PROFILE_SEARCH_PAGE - 1), ...found(1, 'PStranger', 99)])
      .mockResolvedValueOnce(found(3, 'PAuthor', 10))
    const search = useProfilePostSearch(
      () => 'PAuthor',
      () => 'pkoin'
    )
    await flush()
    expect(mocks.searchPosts).toHaveBeenLastCalledWith(
      'pkoin',
      { start: 0, count: PROFILE_SEARCH_PAGE, fixedBlock: 3_000_000 },
      'PAuthor'
    )
    expect(search.posts.value).toHaveLength(PROFILE_SEARCH_PAGE - 1)
    expect(search.hasMore.value).toBe(true)

    search.loadMore()
    await flush()
    expect(mocks.searchPosts).toHaveBeenLastCalledWith(
      'pkoin',
      { start: PROFILE_SEARCH_PAGE, count: PROFILE_SEARCH_PAGE, fixedBlock: 3_000_000 },
      'PAuthor'
    )
    expect(search.posts.value.map((p) => p.txid).slice(-3)).toEqual(['t10', 't11', 't12'])
    expect(search.hasMore.value).toBe(false)
    expect(mocks.height).toHaveBeenCalledTimes(1)
  })

  it('новые слова — выдача заново; запоздавший ответ на прежние не попадает', async () => {
    let answerOld: (v: unknown) => void = () => {}
    mocks.searchPosts
      .mockImplementationOnce(() => new Promise((r) => (answerOld = r)))
      .mockResolvedValueOnce(found(2, 'PAuthor', 50))
    const query = ref('old')
    const search = useProfilePostSearch(
      () => 'PAuthor',
      () => query.value
    )
    await flush()
    query.value = 'new'
    await nextTick()
    await flush()
    answerOld(found(5))
    await flush()
    expect(search.posts.value.map((p) => p.txid)).toEqual(['t50', 't51'])
    expect(search.loading.value).toBe(false)
  })

  it('ошибка — «Повторить» запрашивает ту же страницу', async () => {
    mocks.searchPosts.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(found(1))
    const search = useProfilePostSearch(
      () => 'PAuthor',
      () => 'pkoin'
    )
    await flush()
    expect(search.error.value).toBe(true)
    search.retry()
    await flush()
    expect(search.error.value).toBe(false)
    expect(search.posts.value).toHaveLength(1)
    expect(mocks.searchPosts.mock.lastCall?.[1]).toMatchObject({ start: 0 })
  })
})
