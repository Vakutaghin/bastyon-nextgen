// Ленты разделов «Видео» и «Аудио»: свежее, лучшее, подписки, ролики автора и
// поиск. Нода фильтрует по типу сама (`video` / `audio` в параметре типов);
// превью, длительность и просмотры — одним запросом к ней же на страницу
// (services/media/media-info).
//
// Поиск видео — `search` с типом `videos`. Аудио нода в поисковый индекс не
// кладёт (WebRepository.cpp: у типа 210 нет ветки), поэтому трек ищем на
// серверах PeerTube, куда сейчас загружают, а посты к найденному — по ссылке
// (`searchlinks`). Старые треки на других серверах так не найдутся.

import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useAuthStore } from '@/blockchain'
import { useUIStore } from '@/stores/ui-store'
import { useBlockedAuthors } from '@/composables/use-blocked-authors'
import { extractPostsFromResponse, type AdaptedPost } from '@/composables/use-feed'
import {
  buildHierarchicalStripQuery,
  buildSubscriptionsFeedQuery,
  buildTopFeedQuery,
  type FeedQueryContext,
} from '@/composables/helpers/feed-queries'
import { preloadLastCommentAuthors } from '@/composables/helpers/feed-enrichment'
import { DEFAULT_TOP_FEED_DEPTH } from '@/stores/filters-store-consts'
import { getByPRCWithAuth, rpcCall } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { fetchMediaInfo, type MediaInfo } from '@/services/media/media-info'
import { mediaTypeOf, postId, type MediaType } from '@/services/media/media-post'
import { searchAudio } from '@/services/media/audio-search'
import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import { logger } from '@/services/logger'

const log = logger.scope('[media-feed]')

export type MediaFeedSource = 'fresh' | 'best' | 'subscriptions' | 'author' | 'search'

export interface MediaFeedOptions {
  type: MediaType
  source: Ref<MediaFeedSource>
  /** Теги рубрики: любой из них. */
  tags?: Ref<string[]>
  /** Строка поиска — для `search`. */
  query?: Ref<string>
  /** Адрес автора — для `author`. */
  author?: Ref<string>
  /** Лента не на экране (другая вкладка) — не грузить. */
  enabled?: Ref<boolean>
  pageSize?: number
}

const freshHash = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2)

/** Страница ленты: посты и чем продолжить. */
interface Page {
  posts: AdaptedPost[]
  /** txid, номер или null — дальше нечего. */
  next: string | number | null
}

export function useMediaFeed(options: MediaFeedOptions) {
  const { type, source, pageSize = 20 } = options
  const authStore = useAuthStore()
  const uiStore = useUIStore()
  const { filterBlocked } = useBlockedAuthors()

  const raw = shallowRef<AdaptedPost[]>([])
  const info = shallowRef<Map<string, MediaInfo>>(new Map())
  const loading = ref(false)
  const error = ref(false)
  const hasMore = ref(true)
  let cursor: string | number | null = null
  let generation = 0

  /** Только ролики или только треки этого раздела, без повторов и заблокированных. */
  const posts = computed<AdaptedPost[]>(() => {
    const seen = new Set<string>()
    return filterBlocked(
      raw.value.filter((p) => {
        const id = postId(p)
        if (!id || seen.has(id) || mediaTypeOf(p) !== type) return false
        seen.add(id)
        return true
      })
    )
  })

  function context(next: string): FeedQueryContext {
    return {
      currentTxid: next,
      count: pageSize,
      lang: uiStore.contentLanguage,
      allTags: (options.tags?.value ?? []).map((tag) => encodeURIComponent(tag.toLowerCase())),
      contentTypes: [type],
      userAddress: authStore.getUserAddress || '',
      topFirst: false,
      depth: DEFAULT_TOP_FEED_DEPTH,
    }
  }

  async function fromStrip(request: Promise<GetHierarchicalStripResponse>): Promise<Page> {
    const response = await request
    await preloadLastCommentAuthors(response?.data?.contents)
    const list = extractPostsFromResponse(response)
    const last = list[list.length - 1]
    return { posts: list, next: list.length >= pageSize && last ? postId(last) : null }
  }

  async function authorPage(next: string): Promise<Page> {
    const address = options.author?.value ?? ''
    if (!address) return { posts: [], next: null }
    const response = (await getByPRCWithAuth({
      method: rpcEndpoints.getProfileFeed,
      // Раскладка getprofilefeed — как в use-profile-feed: адрес на индексе 10.
      parameters: [0, next, pageSize, '', [], [type], [], [], [], '', address, '', '', 'desc'],
      cachehash: freshHash(),
      options: { ex: true },
    })) as GetHierarchicalStripResponse
    const list = extractPostsFromResponse(response)
    const last = list[list.length - 1]
    return { posts: list, next: list.length >= pageSize && last ? postId(last) : null }
  }

  async function searchPage(start: number): Promise<Page> {
    const text = (options.query?.value ?? '').trim()
    if (!text) return { posts: [], next: null }
    if (type === 'audio') {
      // PeerTube отдаёт всё найденное сразу — вторая страница не нужна.
      if (start > 0) return { posts: [], next: null }
      return { posts: await searchAudio(text), next: null }
    }
    const data = await rpcCall<{ posts?: { data?: unknown[] } }>({
      method: rpcEndpoints.search,
      parameters: [text, 'videos', 0, start, pageSize],
      options: { auth: false },
    })
    const rows = data?.posts?.data ?? []
    const list = extractPostsFromResponse({
      data: { contents: rows },
    } as unknown as GetHierarchicalStripResponse)
    return { posts: list, next: rows.length >= pageSize ? start + rows.length : null }
  }

  function loadPage(): Promise<Page> {
    const next = cursor
    switch (source.value) {
      case 'best':
        return fromStrip(buildTopFeedQuery(context(String(next ?? ''))))
      case 'subscriptions':
        return fromStrip(buildSubscriptionsFeedQuery(context(String(next ?? ''))))
      case 'author':
        return authorPage(String(next ?? ''))
      case 'search':
        return searchPage(typeof next === 'number' ? next : 0)
      default:
        return fromStrip(buildHierarchicalStripQuery(context(String(next ?? ''))))
    }
  }

  async function loadMore(): Promise<void> {
    if (loading.value || !hasMore.value || options.enabled?.value === false) return
    const mine = generation
    loading.value = true
    error.value = false
    try {
      const page = await loadPage()
      if (mine !== generation) return
      raw.value = [...raw.value, ...page.posts]
      cursor = page.next
      hasMore.value = page.next !== null && page.posts.length > 0
      const urls = page.posts.filter((p) => mediaTypeOf(p)).map((p) => p.videoUrl!)
      const fresh = await fetchMediaInfo(urls)
      if (mine !== generation || !fresh.size) return
      info.value = new Map([...info.value, ...fresh])
    } catch (e) {
      if (mine !== generation) return
      log.warn('page failed', source.value, e)
      error.value = true
    } finally {
      if (mine === generation) loading.value = false
    }
  }

  /** С начала: сменили вкладку, рубрику, поиск или язык ленты. */
  function reload(): void {
    generation += 1
    raw.value = []
    cursor = null
    hasMore.value = true
    loading.value = false
    error.value = false
    void loadMore()
  }

  watch(
    () => [
      source.value,
      (options.tags?.value ?? []).join(','),
      options.query?.value ?? '',
      options.author?.value ?? '',
      uiStore.contentLanguage,
      authStore.getUserAddress,
      options.enabled?.value ?? true,
    ],
    reload,
    { immediate: true }
  )

  return { posts, info, loading, error, hasMore, loadMore, reload }
}
