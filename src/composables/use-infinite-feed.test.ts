/**
 * Лента: поведение вокруг догрузки страниц.
 *
 * `useQuery` подменён управляемым стабом — интересует не сеть, а реакция
 * композибла на ответ/ошибку: V35 (ошибка догрузки не вешает спиннер и не
 * стирает ленту), S16 (страница прошлого фильтра не доклеивается в новую
 * ленту), S17 («Обновить» идёт с головы, а не повторяет текущую страницу),
 * имена авторов последних комментариев догружаются до показа страницы,
 * лента на редком языке по одному посту, «Новые посты сразу».
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const queryState = {
  data: shallowRef<unknown>(undefined),
  isLoading: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn<() => Promise<{ isError: boolean; error?: unknown }>>(),
  lastOptions: null as { queryFn?: () => Promise<unknown> } | null,
}

vi.mock('@tanstack/vue-query', () => ({
  useQuery: (options: { queryFn?: () => Promise<unknown> }) => {
    queryState.lastOptions = options
    return {
      data: queryState.data,
      isLoading: queryState.isLoading,
      error: queryState.error,
      refetch: queryState.refetch,
    }
  },
}))

// Адаптация ответа — отдельная зона ответственности; здесь важны только id.
vi.mock('./use-feed', () => ({
  extractPostsFromResponse: (resp: { data?: { contents?: Array<{ txid: string }> } }) =>
    (resp?.data?.contents ?? []).map((c) => ({ id: c.txid, txid: c.txid })),
}))

const mergeRepostOriginals = vi.fn<() => Promise<void>>(() => Promise.resolve())
const preloadAuthors = vi.fn<(contents: unknown) => Promise<void>>(() => Promise.resolve())
vi.mock('./helpers/feed-enrichment', () => ({
  fetchAndMergeRepostOriginals: () => mergeRepostOriginals(),
  enrichWithUserScores: vi.fn(),
  preloadLastCommentAuthors: (contents: unknown) => preloadAuthors(contents),
}))

vi.mock('./helpers/feed-queries', () => ({
  buildFeedQueryByTab: vi.fn(async () => ({ data: { contents: [] } })),
}))

// Лента по дате идёт через date-feed; здесь он прозрачен — отдаёт запрос
// вкладки целой страницей. Редкий язык — свои тесты ниже и date-feed.test.ts.
vi.mock('./helpers/date-feed', async () => {
  const queries = await import('./helpers/feed-queries')
  class SparseLanguageTimeout extends Error {
    constructor(readonly first: boolean) {
      super('timeout')
    }
  }
  return {
    SparseLanguageTimeout,
    isSparseFeed: vi.fn(() => false),
    fetchDatePage: vi.fn(async (ctx: { count: number }) => ({
      response: await queries.buildFeedQueryByTab(1, ctx as never),
      requested: ctx.count,
    })),
  }
})

vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ address: '', isUserAuthenticated: false }),
}))

const filtersStore = reactive({
  activeTab: 1,
  topFirst: false,
  liveFeed: false,
  topFeedDepth: 10080,
  selectedCategories: [] as string[],
  selectedTags: [] as string[],
  customCategories: [] as unknown[],
  allCategories: [] as unknown[],
  timeFilters: [{ id: 1, active: true }],
  sortFilters: [{ id: 1, active: true }],
  isInitialized: true,
  init: vi.fn(),
})
vi.mock('@/stores/filters-store', () => ({ useFiltersStore: () => filtersStore }))
vi.mock('@/stores/ui-store', () => ({
  useUIStore: () => ({ language: 'ru', contentLanguage: 'ru' }),
}))

import { feedErrorText, useInfiniteFeed } from './use-infinite-feed'
import { NoDirectNodesError } from '@/helpers/api/direct-nodes/node-pool'
import { t } from '@/i18n'
import { buildFeedQueryByTab } from './helpers/feed-queries'
import { SparseLanguageTimeout, fetchDatePage, isSparseFeed } from './helpers/date-feed'

type FeedApi = ReturnType<typeof useInfiniteFeed>

// Каждый инстанс держит свой watcher на общем `queryState.data`, поэтому
// компоненты предыдущих тестов обязательно размонтировать — иначе они съедают
// одноразовые моки и портят следующий тест.
const mounted: VueWrapper[] = []

function mountFeed(): FeedApi {
  let api: FeedApi | null = null
  const harness = defineComponent({
    setup() {
      api = useInfiniteFeed({ initialLimit: 2, pageSize: 2 })
      return () => h('div')
    },
  })
  mounted.push(mount(harness, { attachTo: document.body }) as unknown as VueWrapper)
  return api as unknown as FeedApi
}

function page(...txids: string[]) {
  return { data: { contents: txids.map((txid) => ({ txid })) } }
}

/** Отдаёт ленте страницу так, как это сделал бы vue-query. */
async function deliver(resp: unknown): Promise<void> {
  queryState.data.value = resp
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
})

beforeEach(() => {
  setActivePinia(createPinia())
  queryState.data.value = undefined
  queryState.isLoading.value = false
  queryState.error.value = null
  queryState.refetch.mockReset()
  queryState.refetch.mockResolvedValue({ isError: false })
  mergeRepostOriginals.mockReset()
  mergeRepostOriginals.mockImplementation(() => Promise.resolve())
  preloadAuthors.mockReset()
  preloadAuthors.mockImplementation(() => Promise.resolve())
  filtersStore.activeTab = 1
  filtersStore.liveFeed = false
})

describe('useInfiniteFeed', () => {
  it('asks the next pages at the block height of the first one, like the old client', async () => {
    const feed = mountFeed()
    const strip = vi.mocked(buildFeedQueryByTab)
    strip.mockClear()
    await queryState.lastOptions!.queryFn!()
    expect(strip.mock.lastCall![1].height).toBe(0)

    await deliver({ data: { height: 4089777, contents: [{ txid: 'a' }, { txid: 'b' }] } })
    await feed.loadMore()
    await queryState.lastOptions!.queryFn!()
    expect(strip.mock.lastCall![1]).toMatchObject({ currentTxid: 'b', height: 4089777 })
  })

  it('a page of nothing but repeats asks for the next by itself; three in a row end the feed', async () => {
    const feed = mountFeed()
    await deliver(page('a', 'b'))
    await feed.loadMore()
    expect(queryState.refetch).toHaveBeenCalledTimes(1)

    await deliver(page('b', 'a'))
    await nextTick()
    expect(queryState.refetch).toHaveBeenCalledTimes(2)
    expect(feed.hasMore.value).toBe(true)

    await deliver(page('a', 'b'))
    await nextTick()
    expect(queryState.refetch).toHaveBeenCalledTimes(3)

    await deliver(page('b', 'a'))
    await nextTick()
    expect(queryState.refetch).toHaveBeenCalledTimes(3)
    expect(feed.hasMore.value).toBe(false)
  })

  it('a rare language: one post per request, with a note; a page of one is not the end', async () => {
    const feed = mountFeed()
    vi.mocked(fetchDatePage).mockResolvedValueOnce({ response: page('x'), requested: 1 } as never)
    vi.mocked(isSparseFeed).mockReturnValueOnce(true)
    await queryState.lastOptions!.queryFn!()
    expect(feed.sparse.value).toBe(true)

    await deliver(page('x'))
    expect(feed.hasMore.value).toBe(true)
  })

  it('the node found no next post in a rare language: words, not the SQL error', () => {
    expect(feedErrorText(new SparseLanguageTimeout(true))).toBe(t('postCard.sparseLanguageNone'))
    expect(feedErrorText(new SparseLanguageTimeout(false))).toBe(t('postCard.sparseLanguageGap'))
  })

  it('keeps the loaded feed and surfaces the reason when a page fails (V35)', async () => {
    const feed = mountFeed()
    await deliver(page('a', 'b'))
    expect(feed.allPosts.value).toHaveLength(2)
    expect(feed.hasMore.value).toBe(true)

    // vue-query отдаёт ошибку в результате, а не бросает.
    queryState.refetch.mockResolvedValueOnce({ isError: true, error: new Error('node down') })
    await feed.loadMore()

    expect(feed.isLoadingMore.value).toBe(false)
    expect(feed.loadMoreError.value).toBe('node down')
    expect(feed.allPosts.value).toHaveLength(2)
  })

  it('no node answered directly: the error says so in words, not as the raw English error', async () => {
    const feed = mountFeed()
    await deliver(page('a', 'b'))
    queryState.refetch.mockResolvedValueOnce({ isError: true, error: new NoDirectNodesError() })
    await feed.loadMore()

    expect(feed.loadMoreError.value).toBe(t('settings.network.statusNoNodes'))
    expect(feedErrorText(new NoDirectNodesError())).not.toMatch(/Pocketnet nodes/)
    // Остальные ошибки — их текстом, без «Error:» впереди.
    expect(feedErrorText(new Error('node down'))).toBe('node down')
  })

  it('retries the failed page and clears the error on success (V35)', async () => {
    const feed = mountFeed()
    await deliver(page('a', 'b'))
    queryState.refetch.mockResolvedValueOnce({ isError: true, error: new Error('node down') })
    await feed.loadMore()
    expect(feed.loadMoreError.value).toBe('node down')

    const retry = feed.retryLoadMore()
    await deliver(page('c', 'd'))
    await retry

    expect(feed.loadMoreError.value).toBeNull()
    expect(feed.allPosts.value.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returning to the app peeks for new posts at most once a minute, never in background', async () => {
    vi.useFakeTimers({ now: 1_000_000, toFake: ['Date'] })
    try {
      mountFeed()
      await deliver(page('a', 'b'))
      const peek = vi.mocked(buildFeedQueryByTab)
      peek.mockClear()

      // Лента только что пришла: возврат в окно её не перезапрашивает.
      window.dispatchEvent(new Event('focus'))
      expect(peek).not.toHaveBeenCalled()

      vi.setSystemTime(1_000_000 + 61_000)
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
      window.dispatchEvent(new Event('focus'))
      expect(peek).not.toHaveBeenCalled()
      hidden.mockRestore()

      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('focus'))
      expect(peek).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('drops a page that belongs to the previous filter (S16)', async () => {
    const feed = mountFeed()
    await deliver(page('a', 'b'))

    // Ответ приходит, но догрузка оригиналов репостов «зависает» — за это
    // время пользователь переключает вкладку.
    // Резолвер держим в объекте: присваивание внутри колбэка TS не отслеживает,
    // и обычная переменная осталась бы сужённой до null.
    const gate: { release?: () => void } = {}
    mergeRepostOriginals.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          gate.release = resolve
        })
    )
    queryState.data.value = page('c', 'd')
    await nextTick()

    filtersStore.activeTab = 3
    await nextTick()
    expect(feed.allPosts.value).toHaveLength(0)

    gate.release?.()
    await nextTick()
    await Promise.resolve()
    await nextTick()

    // Страница старой вкладки не должна «воскресить» ленту.
    expect(feed.allPosts.value).toHaveLength(0)
  })

  it('refreshes from the head instead of repeating the current page (S17)', async () => {
    const feed = mountFeed()
    await deliver(page('a', 'b'))
    await feed.loadMore()
    await deliver(page('c', 'd'))
    expect(feed.allPosts.value).toHaveLength(4)

    const refreshed = feed.refetch()
    await deliver(page('e', 'f'))
    await refreshed

    // Голова перезапрошена: лента заменена, а не дополнена.
    expect(feed.allPosts.value.map((p) => p.id)).toEqual(['e', 'f'])
    expect(feed.hasMore.value).toBe(true)
  })

  it('the page request resolves only after last-comment authors have names', async () => {
    mountFeed()
    const contents = [{ txid: 'a', lastComment: { address: 'PCommenter' } }]
    vi.mocked(buildFeedQueryByTab).mockResolvedValueOnce({ data: { contents } } as never)
    const gate: { release?: () => void } = {}
    preloadAuthors.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          gate.release = resolve
        })
    )

    let resolved = false
    const request = queryState.lastOptions!.queryFn!().then((response) => {
      resolved = true
      return response
    })
    await vi.waitFor(() => expect(preloadAuthors).toHaveBeenCalledWith(contents))
    await Promise.resolve()
    // Пока имена не пришли, лента крутит загрузку, а не рисует адреса.
    expect(resolved).toBe(false)

    gate.release?.()
    await expect(request).resolves.toEqual({ data: { contents } })
  })

  it('asks for a page three screens before the end; a short page that leaves the trigger in the zone is followed by the next one', async () => {
    const observers: Array<{ report: IntersectionObserverCallback; margin?: string }> = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(report: IntersectionObserverCallback, init?: IntersectionObserverInit) {
          observers.push({ report, margin: init?.rootMargin })
        }
        observe(): void {}
        disconnect(): void {}
      }
    )
    const inZone = (isIntersecting: boolean): void =>
      observers[observers.length - 1]!.report(
        [{ isIntersecting } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    try {
      const feed = mountFeed()
      await deliver(page('a', 'b'))
      feed.loadMoreTrigger.value = document.createElement('div')
      await nextTick()
      await nextTick()
      expect(observers[observers.length - 1]!.margin).toBe(`${window.innerHeight * 3}px 0px`)

      inZone(true)
      expect(queryState.refetch).toHaveBeenCalledTimes(1)
      await deliver(page('c', 'd'))

      // Наблюдатель молчит: триггер не выходил из зоны. Проверка после показа догружает.
      feed.recheckLoadMore()
      expect(queryState.refetch).toHaveBeenCalledTimes(2)
      await deliver(page('e', 'f'))

      inZone(false)
      feed.recheckLoadMore()
      expect(queryState.refetch).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('sends category and picked tags in lower case, like legacy', async () => {
    filtersStore.selectedCategories = ['c4', 'custom_x']
    filtersStore.allCategories = [{ id: 'c4', tags: ['криптовалюта'] }]
    filtersStore.selectedTags = ['Кофе']
    try {
      mountFeed()
      await queryState.lastOptions!.queryFn!()
      expect(vi.mocked(buildFeedQueryByTab).mock.lastCall![1].allTags).toEqual([
        encodeURIComponent('криптовалюта'),
        encodeURIComponent('кофе'),
      ])
    } finally {
      filtersStore.selectedCategories = []
      filtersStore.allCategories = []
      filtersStore.selectedTags = []
    }
  })
  describe('«Новые посты сразу»', () => {
    const ids = (feed: FeedApi): string[] => feed.allPosts.value.map((p) => String(p.id))
    const flush = async (): Promise<void> => {
      for (let i = 0; i < 5; i++) await Promise.resolve()
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('new posts go on top one by one, the oldest of them first', async () => {
      filtersStore.liveFeed = true
      const feed = mountFeed()
      await deliver(page('a', 'b'))
      vi.mocked(buildFeedQueryByTab).mockResolvedValueOnce(page('n2', 'n1', 'a') as never)

      window.dispatchEvent(new Event('focus'))
      await flush()
      await vi.advanceTimersByTimeAsync(0)
      expect(ids(feed)).toEqual(['n1', 'a', 'b'])
      // Голову спросили от последнего блока, а не на высоте первой страницы.
      expect(vi.mocked(fetchDatePage).mock.lastCall![0]).toMatchObject({
        currentTxid: '',
        height: 0,
      })

      await vi.advanceTimersByTimeAsync(1_500)
      expect(ids(feed)).toEqual(['n2', 'n1', 'a', 'b'])
      expect(feed.newPostsCount.value).toBe(0)
    })

    it('polls every half a minute and never in the best-first feed', async () => {
      filtersStore.liveFeed = true
      mountFeed()
      await deliver(page('a', 'b'))
      const peek = vi.mocked(fetchDatePage)
      peek.mockClear()

      await vi.advanceTimersByTimeAsync(30_000)
      expect(peek).toHaveBeenCalledTimes(1)

      filtersStore.topFirst = true
      await nextTick()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(peek).toHaveBeenCalledTimes(1)
      filtersStore.topFirst = false
    })

    it('more new posts than three pages: the pill instead of a gap in the feed', async () => {
      filtersStore.liveFeed = true
      const feed = mountFeed()
      await deliver(page('a', 'b'))
      let n = 0
      // Каждый раз полная страница из 20 незнакомых: до показанного не дойти.
      const fresh = (): unknown => page(...Array.from({ length: 20 }, () => `n${n++}`))
      vi.mocked(buildFeedQueryByTab).mockImplementation(async () => fresh() as never)
      try {
        window.dispatchEvent(new Event('focus'))
        await vi.waitFor(() => expect(feed.newPostsCount.value).toBe(60))
        await vi.advanceTimersByTimeAsync(5_000)
        expect(ids(feed)).toEqual(['a', 'b'])
      } finally {
        vi.mocked(buildFeedQueryByTab).mockImplementation(
          async () => ({ data: { contents: [] } }) as never
        )
      }
    })

    it('a rare language: the head without a jump over a break, at most once in five minutes', async () => {
      filtersStore.liveFeed = true
      mountFeed()
      vi.mocked(isSparseFeed).mockReturnValue(true)
      try {
        await queryState.lastOptions!.queryFn!()
        await deliver(page('a', 'b'))
        const peek = vi.mocked(fetchDatePage)
        peek.mockClear()

        window.dispatchEvent(new Event('focus'))
        await flush()
        expect(peek).toHaveBeenCalledTimes(1)
        expect(peek.mock.lastCall![1]).toEqual({ jump: false })

        window.dispatchEvent(new Event('focus'))
        await vi.advanceTimersByTimeAsync(60_000)
        expect(peek).toHaveBeenCalledTimes(1)
      } finally {
        vi.mocked(isSparseFeed).mockReturnValue(false)
      }
    })
  })
})
