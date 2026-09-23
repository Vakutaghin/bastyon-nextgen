/**
 * Лента: поведение вокруг догрузки страниц.
 *
 * `useQuery` подменён управляемым стабом — интересует не сеть, а реакция
 * композибла на ответ/ошибку: V35 (ошибка догрузки не вешает спиннер и не
 * стирает ленту), S16 (страница прошлого фильтра не доклеивается в новую
 * ленту), S17 («Обновить» идёт с головы, а не повторяет текущую страницу).
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
vi.mock('./helpers/feed-enrichment', () => ({
  fetchAndMergeRepostOriginals: () => mergeRepostOriginals(),
  enrichWithUserScores: vi.fn(),
}))

vi.mock('./helpers/feed-queries', () => ({
  buildFeedQueryByTab: vi.fn(async () => ({ data: { contents: [] } })),
}))

vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ address: '', isUserAuthenticated: false }),
}))

const filtersStore = reactive({
  activeTab: 1,
  topFirst: false,
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
vi.mock('@/stores/ui-store', () => ({ useUIStore: () => ({ language: 'ru' }) }))

import { useInfiniteFeed } from './use-infinite-feed'

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
  filtersStore.activeTab = 1
})

describe('useInfiniteFeed', () => {
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
})
