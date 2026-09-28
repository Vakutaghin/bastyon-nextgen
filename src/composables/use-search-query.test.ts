// Поиск в шапке и на /search: запрос уходит от двух символов после чистки,
// «#тег #тег» — это лента по тегам, а не полнотекстовый поиск (как в старом
// клиенте), страницы одной выдачи держатся на одном блоке и сбрасывают его
// при смене запроса или вкладки, найденные имена запоминаются для @упоминаний.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'

type Options = {
  queryKey: unknown
  queryFn: () => Promise<unknown>
  enabled: { value: boolean }
}

const mocks = vi.hoisted(() => ({
  options: [] as Options[],
  data: null as unknown as { value: unknown },
  searchUsers: vi.fn(),
  searchPosts: vi.fn(),
  searchTags: vi.fn(),
  getCurrentBlockHeight: vi.fn(),
  rpcCall: vi.fn(),
  registerNameAddress: vi.fn(),
}))
vi.mock('@tanstack/vue-query', () => ({
  useQuery: (options: Options) => {
    mocks.options.push(options)
    return { data: mocks.data }
  },
}))
vi.mock('@/services/search-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/search-service')>()
  return {
    sanitizeSearchQuery: actual.sanitizeSearchQuery,
    searchUsers: mocks.searchUsers,
    searchPosts: mocks.searchPosts,
    searchTags: mocks.searchTags,
    getCurrentBlockHeight: mocks.getCurrentBlockHeight,
  }
})
vi.mock('@/helpers/api/request', () => ({ rpcCall: mocks.rpcCall, getByPRC: vi.fn() }))
vi.mock('@/services/user-resolver', () => ({ registerNameAddress: mocks.registerNameAddress }))
vi.mock('@/mini-apps/registry/remote-registry', () => ({ RemoteAppsLoader: class {} }))

import {
  parseTagOnlyQuery,
  useFeedByTags,
  useSearchByType,
  useSearchPagination,
  useSearchUsers,
  type SearchTabType,
} from './use-search-query'

const last = () => mocks.options[mocks.options.length - 1]!

describe('поиск', () => {
  beforeEach(() => {
    mocks.options = []
    mocks.data = shallowRef<unknown>(undefined)
    for (const fn of [
      mocks.searchUsers,
      mocks.searchPosts,
      mocks.searchTags,
      mocks.getCurrentBlockHeight,
      mocks.rpcCall,
      mocks.registerNameAddress,
    ])
      fn.mockReset()
  })

  it.each([
    ['#pkoin', ['pkoin']],
    ['  #News   #BTC ', ['news', 'btc']],
    ['##двойной', ['двойной']],
    ['#pkoin and', null],
    ['#', null],
    ['   ', null],
    ['просто текст', null],
  ])('parseTagOnlyQuery(%j) → %j', (input, expected) => {
    expect(parseTagOnlyQuery(input)).toEqual(expected)
  })

  it('запрос включается от двух символов после чистки', () => {
    const query = ref('a!')
    useSearchUsers(query)
    expect(last().enabled.value).toBe(false)
    query.value = '!!ab'
    expect(last().enabled.value).toBe(true)
    query.value = '比特'
    expect(last().enabled.value).toBe(true)
  })

  it('найденные в шапке пользователи запоминаются для упоминаний', async () => {
    useSearchUsers(ref('bob'))
    mocks.data.value = [{ address: 'PBob', name: 'bob' }]
    await nextTick()
    expect(mocks.registerNameAddress).toHaveBeenCalledWith([{ address: 'PBob', name: 'bob' }])
  })

  it('лента по тегам: gethierarchicalstrip с tagsfilter, без тегов — не запрашивается', async () => {
    const tags = ref<string[]>([])
    useFeedByTags(tags, ref('ru'), ref(20))
    expect(last().enabled.value).toBe(false)
    tags.value = ['pkoin', 'news']
    expect(last().enabled.value).toBe(true)
    await last().queryFn()
    expect(mocks.rpcCall).toHaveBeenCalledWith({
      method: 'gethierarchicalstrip',
      parameters: [0, '', 20, 'ru', ['pkoin', 'news'], [], [], [], [], '', ''],
      options: { auth: false, ex: true },
    })
  })

  describe('useSearchPagination', () => {
    it('блок фиксируется один раз и сбрасывается при смене запроса или вкладки', async () => {
      mocks.getCurrentBlockHeight.mockResolvedValue(3_200_000)
      const query = ref('bitcoin')
      const type = ref<SearchTabType>('posts')
      const { fixedBlock, resolveBlock } = useSearchPagination(query, type)

      await resolveBlock()
      await resolveBlock()
      expect(fixedBlock.value).toBe(3_200_000)
      expect(mocks.getCurrentBlockHeight).toHaveBeenCalledTimes(1)

      query.value = 'pkoin'
      await nextTick()
      expect(fixedBlock.value).toBe(0)

      await resolveBlock()
      type.value = 'users'
      await nextTick()
      expect(fixedBlock.value).toBe(0)
    })

    it('нода не дала высоту — страницы без фиксации (0)', async () => {
      mocks.getCurrentBlockHeight.mockResolvedValue(null)
      const { fixedBlock, resolveBlock } = useSearchPagination(ref('x y'), ref('posts'))
      await resolveBlock()
      expect(fixedBlock.value).toBe(0)
    })
  })

  describe('useSearchByType', () => {
    it('вкладка выбирает метод, пагинация передаётся как есть', async () => {
      const type = ref<SearchTabType>('users')
      const paging = ref({ start: 20, count: 10, fixedBlock: 5 })
      useSearchByType(ref('bob'), type, paging)
      const options = last()

      await options.queryFn()
      expect(mocks.searchUsers).toHaveBeenCalledWith('bob', paging.value)
      type.value = 'posts'
      await options.queryFn()
      expect(mocks.searchPosts).toHaveBeenCalledWith('bob', paging.value)
      type.value = 'tags'
      await options.queryFn()
      expect(mocks.searchTags).toHaveBeenCalledWith('bob', paging.value)
    })

    it('имена авторов из найденных постов тоже запоминаются', async () => {
      useSearchByType(ref('pkoin'), ref<SearchTabType>('posts'), ref({}))
      mocks.data.value = [
        { txid: 'p1', userprofile: { address: 'PA', name: 'alice' } },
        { txid: 'p2' },
      ]
      await nextTick()
      expect(mocks.registerNameAddress).toHaveBeenCalledWith([{ address: 'PA', name: 'alice' }])
    })
  })
})
