// Ленты разделов «Видео» и «Аудио»: свежее, лучшее, подписки, ролики автора и
// поиск. Нода фильтрует по типу сама (`video` / `audio` в параметре типов);
// превью, длительность и просмотры — одним запросом к ней же на страницу
// (services/media/media-info).
//
// Поиск видео — `search` с типом `videos`. Аудио нода в поисковый индекс не
// кладёт (WebRepository.cpp: у типа 210 нет ветки), поэтому трек ищем на
// серверах PeerTube, куда сейчас загружают, а посты к найденному — по ссылке
// (`searchlinks`). Старые треки на других серверах так не найдутся.
//
// Ролики автора (профиль) — getprofilefeed: тег и порядок нода понимает сама.
// Поиск по ним — тот же `search` с адресом автора шестым параметром.
// Слово в getprofilefeed (`keyword`) нода не применяет: проба 11.11.2026 —
// на всех прокси и с бессмысленным словом отдаёт все ролики.

import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useAuthStore } from '@/blockchain'
import { useUIStore } from '@/stores/ui-store'
import { useBlockedAuthors } from '@/composables/use-blocked-authors'
import { extractPostsFromResponse, type AdaptedPost } from '@/composables/use-feed'
import {
  buildSubscriptionsFeedQuery,
  buildTopFeedQuery,
  type FeedQueryContext,
} from '@/composables/helpers/feed-queries'
import { fetchDatePage } from '@/composables/helpers/date-feed'
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

/**
 * Порядок роликов автора. Листается только `new`: курсор getprofilefeed —
 * «id меньше этого», и с другим порядком вторая страница повторяет первую.
 * Список исключённых txid прокси склеивает в одну строку, а номер страницы
 * приводит к строке — обойти нечем (проба 11.11.2026). Больше 20 за раз нода
 * не отдаёт, поэтому в остальных порядках — первые 20.
 */
export type AuthorOrder = 'new' | 'popular' | 'discussed' | 'old'

/** orderby и ascdesc getprofilefeed для порядка. */
const ORDER_PARAMS: Record<AuthorOrder, [string, 'asc' | 'desc']> = {
  new: ['', 'desc'],
  popular: ['score', 'desc'],
  discussed: ['comment', 'desc'],
  old: ['', 'asc'],
}

export interface MediaFeedOptions {
  type: MediaType
  source: Ref<MediaFeedSource>
  /** Теги рубрики: любой из них. У `author` — тоже. */
  tags?: Ref<string[]>
  /** Строка поиска — для `search`. */
  query?: Ref<string>
  /** Адрес автора — для `author`; у `search` — искать только его ролики. */
  author?: Ref<string>
  /** Порядок роликов автора — для `author`. */
  order?: Ref<AuthorOrder>
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
  /** Дальше ролики есть, но нода в этом порядке их не отдаёт. */
  capped?: boolean
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
  const capped = ref(false)
  let cursor: string | number | null = null
  let generation = 0
  /** Высота блока первой страницы — с ней следующие (FeedQueryContext.height). */
  let height = 0

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

  const encodedTags = (): string[] =>
    (options.tags?.value ?? []).map((tag) => encodeURIComponent(tag.toLowerCase()))

  function context(next: string): FeedQueryContext {
    return {
      currentTxid: next,
      count: pageSize,
      lang: uiStore.contentLanguage,
      allTags: encodedTags(),
      contentTypes: [type],
      userAddress: authStore.getUserAddress || '',
      topFirst: false,
      depth: DEFAULT_TOP_FEED_DEPTH,
      height: next ? height : 0,
    }
  }

  /** «Свежее» — по дате, как лента; на редком языке — по одному посту (date-feed.ts). */
  async function freshPage(next: string): Promise<Page> {
    const page = await fetchDatePage(context(next))
    return fromStrip(Promise.resolve(page.response), page.requested)
  }

  /** `requested` — сколько постов просили: пришло меньше — дальше пусто. */
  async function fromStrip(
    request: Promise<GetHierarchicalStripResponse>,
    requested = pageSize
  ): Promise<Page> {
    const first = cursor === null
    const response = await request
    if (first) height = Number(response?.data?.height) || 0
    await preloadLastCommentAuthors(response?.data?.contents)
    const list = extractPostsFromResponse(response)
    const last = list[list.length - 1]
    return { posts: list, next: list.length >= requested && last ? postId(last) : null }
  }

  async function authorPage(next: string): Promise<Page> {
    const address = options.author?.value ?? ''
    if (!address) return { posts: [], next: null }
    const order = options.order?.value ?? 'new'
    const [orderby, ascdesc] = ORDER_PARAMS[order]
    const response = (await getByPRCWithAuth({
      method: rpcEndpoints.getProfileFeed,
      // Раскладка getprofilefeed — как в use-profile-feed: адрес на индексе 10.
      parameters: [
        0,
        next,
        pageSize,
        '',
        encodedTags(),
        [type],
        [],
        [],
        [],
        '',
        address,
        '',
        orderby,
        ascdesc,
      ],
      cachehash: freshHash(),
      options: { ex: true },
    })) as GetHierarchicalStripResponse
    const list = extractPostsFromResponse(response)
    const last = list[list.length - 1]
    const full = list.length >= pageSize && !!last
    if (order !== 'new') return { posts: list, next: null, capped: full }
    return { posts: list, next: full ? postId(last) : null }
  }

  async function searchPage(start: number): Promise<Page> {
    const text = (options.query?.value ?? '').trim()
    if (!text) return { posts: [], next: null }
    if (type === 'audio') {
      // PeerTube отдаёт всё найденное сразу — вторая страница не нужна.
      if (start > 0) return { posts: [], next: null }
      return { posts: await searchAudio(text), next: null }
    }
    const address = options.author?.value ?? ''
    const parameters: unknown[] = [text, 'videos', 0, start, pageSize]
    if (address) parameters.push(address)
    const data = await rpcCall<{ posts?: { data?: unknown[] } }>({
      method: rpcEndpoints.search,
      parameters,
      options: { auth: false },
    })
    const rows = data?.posts?.data ?? []
    const list = extractPostsFromResponse({
      data: { contents: rows },
    } as unknown as GetHierarchicalStripResponse)
    // Нода без фильтра по автору отдала бы чужие ролики — в профиле их не показываем.
    const mine = address ? list.filter((p) => p.author?.address === address) : list
    return { posts: mine, next: rows.length >= pageSize ? start + rows.length : null }
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
        return freshPage(String(next ?? ''))
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
      capped.value = page.capped === true
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
    height = 0
    hasMore.value = true
    capped.value = false
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
      options.order?.value ?? 'new',
      uiStore.contentLanguage,
      authStore.getUserAddress,
      options.enabled?.value ?? true,
    ],
    reload,
    { immediate: true }
  )

  return { posts, info, loading, error, hasMore, capped, loadMore, reload }
}
