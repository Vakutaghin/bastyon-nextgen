/**
 * Composable для infinite scroll (ленивой загрузки) ленты постов
 *
 * Использует Intersection Observer для определения, когда пользователь
 * приближается к концу ленты, и автоматически загружает следующую порцию постов.
 */

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type {
  GetHierarchicalStripPost,
  GetHierarchicalStripResponse,
} from '@/types/rpc-responses/get-hierarchical-strip'
import { extractPostsFromResponse, type AdaptedPost } from './use-feed'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useFiltersStore } from '@/stores/filters-store'
import { useUIStore } from '@/stores/ui-store'
import { wsService } from '@/blockchain/ws'
import { buildFeedQueryByTab, type FeedQueryContext } from './helpers/feed-queries'
import {
  SparseLanguageTimeout,
  fetchDatePage,
  isSparseFeed,
  type DatePage,
} from './helpers/date-feed'
import { prefetchMargin } from './use-load-more-sentinel'
import {
  fetchAndMergeRepostOriginals,
  enrichWithUserScores,
  preloadLastCommentAuthors,
} from './helpers/feed-enrichment'
import { extractErrorMessage } from '@/helpers/common/extract-error-message'
import { NoDirectNodesError } from '@/helpers/api/direct-nodes/node-pool'
import { t } from '@/i18n'

/**
 * Текст ошибки ленты. Не ответила ни одна нода — словами настроек
 * подключения, а не технической строкой «No Pocketnet nodes answered directly».
 */
export function feedErrorText(err: unknown): string {
  if (err instanceof NoDirectNodesError) return t('settings.network.statusNoNodes')
  if (err instanceof SparseLanguageTimeout) {
    return t(err.first ? 'postCard.sparseLanguageNone' : 'postCard.sparseLanguageGap')
  }
  return extractErrorMessage(err)
}

/** Вкладки со своим источником — не лента по дате: «Подписки», «Избранное», «Обсуждаемое». */
const OWN_SOURCE_TABS = new Set([2, 6, 7])
/** Где «Новые посты сразу»: ленты по дате — главная, подписки, видео, аудио, статьи. */
const LIVE_TABS = new Set([1, 2, 3, 4, 5])

/**
 * Сколько страниц подряд из одних уже показанных постов терпеть, прежде чем
 * считать ленту законченной. Такая страница — не конец: идём дальше сами.
 */
const MAX_REPEATED_PAGES = 3

/**
 * Параметры для useInfiniteFeed
 */
export interface UseInfiniteFeedOptions {
  /** Начальное количество постов для первой загрузки */
  initialLimit?: number
  /** Количество постов для каждой последующей загрузки */
  pageSize?: number
  /** За сколько пикселей до конца просить страницу (по умолчанию PREFETCH_SCREENS экранов) */
  threshold?: number
  /** Язык контента. Если не задан — берётся реактивно из ui-store (фильтр языка ленты). */
  lang?: string
  /** Включен ли запрос */
  enabled?: boolean
}

/**
 * Infinite scroll для hierarchical strip

 */
export function useInfiniteFeed(options: UseInfiniteFeedOptions = {}) {
  const { initialLimit = 20, pageSize = 20, threshold, enabled = true } = options

  const authStore = useAuthStore()
  const filtersStore = useFiltersStore()
  const uiStore = useUIStore()

  // Язык контента: явно переданный (options.lang) приоритетнее, иначе — фильтр
  // языка ленты из ui-store, а без него — язык интерфейса (legacy брал
  // `app.localization.key`). Реактивен: смена языка перезагружает ленту.
  const lang = computed(() => options.lang ?? uiStore.contentLanguage)

  onMounted(() => {
    if (!filtersStore.isInitialized) {
      filtersStore.init()
    }
  })

  // Состояние пагинации
  const allPosts = ref<ReturnType<typeof extractPostsFromResponse>>([])
  const lastTxid = ref<string>('')
  const hasMore = ref(true)
  const isLoadingMore = ref(false)
  const loadMoreTrigger = ref<HTMLElement | null>(null)
  let intersectionObserver: IntersectionObserver | null = null
  /** Триггер сейчас в зоне догрузки — по последнему отчёту наблюдателя. */
  let triggerInZone = false

  // Отслеживаем текущий txid для запроса
  const currentTxidForQuery = ref<string>('')
  /** Высота блока первой страницы — с ней просим следующие (`FeedQueryContext.height`). */
  let feedHeight = 0
  /** Ленту на этом языке нода целыми страницами не собирает — посты приходят по одному (date-feed.ts). */
  const sparse = ref(false)
  /** Сколько постов просили в последнем запросе: пришло меньше — лента кончилась. */
  let requestedCount = initialLimit
  /** Страниц подряд, в которых не нашлось ничего нового. */
  let repeatedPages = 0

  // Поколение ленты. Растёт при любом сбросе (смена фильтров/вкладки/языка).
  // Обработчик ответа держит паузу на `await` внутри — за это время фильтр мог
  // смениться, и раньше страница старого таба доклеивалась в новую ленту (S16).
  const feedGeneration = ref(0)

  // Ошибка догрузки СТРАНИЦЫ (не первой загрузки): показывается под лентой,
  // уже загруженные посты остаются на экране (V35).
  const loadMoreError = ref<string | null>(null)

  // Счётчик новых постов сверху ленты (lentaunseen-lite): фоновая проверка головы
  // ленты vs отображаемой; пилюля «новые посты» в content-feed.
  const newPostsCount = ref<number>(0)
  /** Когда голова ленты последний раз приходила с сервера — загрузкой или проверкой. */
  let lastNewPostsCheck = 0

  // Ответ по текущему фильтру уже разобран и разложен в allPosts. Без этого
  // признака «Лента пуста» мигала: между «isLoading стал false» и «посты
  // разложены» проходит асинхронная догрузка оригиналов репостов, и в это
  // окно лента выглядела пустой и загруженной одновременно.
  const hasSettled = ref(false)

  // Следим за изменениями фильтров
  watch(
    [
      () => filtersStore.activeTab,
      () => filtersStore.timeFilters,
      () => filtersStore.sortFilters,
      () => filtersStore.topFirst, // Тоггл «Сначала лучшее» → переключение источника на gettopfeed
      () => lang.value, // Смена языка контента
      () => filtersStore.selectedCategories,
      () => filtersStore.selectedTags,
      () => filtersStore.customCategories, // Следим за изменением определений кастомных категорий
    ],
    () => {
      // Сбрасываем состояние при изменении фильтров
      feedGeneration.value += 1
      currentTxidForQuery.value = ''
      hasSettled.value = false
      hasMore.value = true
      allPosts.value = []
      isLoadingMore.value = false
      loadMoreError.value = null
      newPostsCount.value = 0
    },
    { deep: true }
  )

  const queryKey = computed(() => [
    'feed',
    'hierarchical-strip-infinite',
    filtersStore.activeTab,
    filtersStore.topFirst,
    filtersStore.topFeedDepth,
    lang.value,
    currentTxidForQuery.value || 'initial',
    filtersStore.selectedCategories,
    filtersStore.selectedTags,
    filtersStore.customCategories, // Добавляем кастомные категории в ключ кэша
  ])

  // Маппинг activeTab → contentTypes (фильтр по типу контента в RPC).
  const buildContentTypes = (): string[] => {
    if (filtersStore.activeTab === 3) return ['video']
    if (filtersStore.activeTab === 4) return ['audio']
    if (filtersStore.activeTab === 5) return ['article']
    return []
  }

  // Объединение тегов категорий + пользовательских тегов (для 4-го параметра RPC: tagsfilter).
  // Нижний регистр — как legacy: нода сравнивает теги с учётом регистра.
  const buildAllTags = (): string[] => {
    const categoryTags = filtersStore.selectedCategories.flatMap((id) => {
      const category = filtersStore.allCategories.find((c) => c.id === id)
      return category ? category.tags : []
    })
    return [...categoryTags, ...filtersStore.selectedTags].map((tag: string) =>
      encodeURIComponent(tag.toLowerCase())
    )
  }

  function feedContext(currentTxid: string, count: number): FeedQueryContext {
    return {
      currentTxid,
      count,
      lang: lang.value,
      allTags: buildAllTags(),
      contentTypes: buildContentTypes(),
      userAddress: authStore.address || '',
      topFirst: filtersStore.topFirst,
      depth: filtersStore.topFeedDepth,
      height: currentTxid === '' ? 0 : feedHeight,
    }
  }

  /** Страница ленты: по дате — через date-feed (редкий язык), остальное — своим запросом вкладки. */
  async function fetchFeedPage(ctx: FeedQueryContext, jump = true): Promise<DatePage> {
    const tab = Number(filtersStore.activeTab)
    if (ctx.topFirst || OWN_SOURCE_TABS.has(tab)) {
      sparse.value = false
      return { response: await buildFeedQueryByTab(tab, ctx), requested: ctx.count }
    }
    try {
      return await fetchDatePage(ctx, { jump })
    } finally {
      sparse.value = isSparseFeed(ctx)
    }
  }

  // Запрос данных — все варианты вкладок диспатчатся в buildFeedQueryByTab.
  const { data, isLoading, error, refetch } = useQuery<GetHierarchicalStripResponse>({
    queryKey: queryKey,
    queryFn: async () => {
      const currentTxid = currentTxidForQuery.value
      const page = await fetchFeedPage(
        feedContext(currentTxid, currentTxid === '' ? initialLimit : pageSize)
      )
      requestedCount = page.requested
      await preloadLastCommentAuthors(page.response?.data?.contents)
      return page.response
    },
    enabled: computed(() => enabled && (hasMore.value || currentTxidForQuery.value === '')),
    staleTime: 0,
    gcTime: 0,
  })

  // Обновляем посты при получении данных
  watch(
    data,
    async (newData) => {
      const generation = feedGeneration.value
      const requestedTxid = currentTxidForQuery.value

      if (!newData?.data?.contents) {
        // Пустой, но состоявшийся ответ — это «постов нет», а не «ещё грузим».
        if (newData) hasSettled.value = true
        if (newData && currentTxidForQuery.value !== '') {
          // Если получили пустой ответ при загрузке следующей страницы, значит больше нет постов
          hasMore.value = false
          isLoadingMore.value = false
        }
        return
      }

      const newPosts: AdaptedPost[] = extractPostsFromResponse(newData)
      const contents = newData.data.contents

      // Подгружаем контент оригиналов для репостов (мутирует newPosts на месте).
      await fetchAndMergeRepostOriginals(newPosts, contents)

      // За время догрузки оригиналов фильтр/вкладка могли смениться — тогда эта
      // страница относится к прошлой ленте и клеить её некуда (S16).
      if (generation !== feedGeneration.value) return

      let postsToEnrich: AdaptedPost[]
      let nothingNew = false
      if (requestedTxid === '') {
        // Первая загрузка — заменяем все посты.
        lastNewPostsCheck = Date.now()
        allPosts.value = newPosts
        postsToEnrich = newPosts
        feedHeight = Number(newData.data.height) || 0
        repeatedPages = 0
      } else {
        // Последующие — добавляем к существующим, фильтруя дубликаты по id.
        const existingIds = new Set(allPosts.value.map((p) => String(p.id)))
        const uniqueNewPosts = newPosts.filter((p) => !existingIds.has(String(p.id)))
        allPosts.value = [...allPosts.value, ...uniqueNewPosts]
        postsToEnrich = uniqueNewPosts
        nothingNew = uniqueNewPosts.length === 0
        repeatedPages = nothingNew ? repeatedPages + 1 : 0
      }

      // Подгружаем оценки текущего юзера и проставляем myVal в allPosts (fire-and-forget).
      if (authStore.address && postsToEnrich.length > 0) {
        enrichWithUserScores(postsToEnrich, allPosts.value, authStore.address)
      }

      // Обновляем lastTxid для следующей загрузки
      if (contents.length > 0) {
        const lastPost = contents[contents.length - 1]
        const newLastTxid = lastPost?.txid || ''

        // Если получили меньше постов, чем запрашивали, значит это последняя страница
        hasMore.value =
          contents.length >= requestedCount &&
          newLastTxid !== requestedTxid &&
          repeatedPages < MAX_REPEATED_PAGES

        if (hasMore.value) {
          lastTxid.value = newLastTxid
        }
      } else {
        hasMore.value = false
      }

      loadMoreError.value = null
      isLoadingMore.value = false
      hasSettled.value = true

      // Страница целиком из уже показанного: лента не выросла, и наблюдатель
      // нового отчёта не пришлёт — следующую просим сами.
      if (nothingNew && hasMore.value) void nextTick(() => loadMore())
    },
    { immediate: true }
  )

  /**
   * Загружает следующую порцию постов
   */
  const loadMore = async () => {
    if (isLoadingMore.value || !hasMore.value || isLoading.value) {
      return
    }

    isLoadingMore.value = true
    loadMoreError.value = null

    try {
      // Обновляем txid для следующего запроса
      currentTxidForQuery.value = lastTxid.value
      // Обновляем query key, что заставит useQuery выполнить новый запрос.
      // `refetch()` vue-query НЕ бросает — ошибку отдаёт в результате, поэтому
      // старый catch никогда не срабатывал и лента залипала в «загружаю» (V35).
      const result = await refetch()
      if (result?.isError) {
        loadMoreError.value = feedErrorText(result.error)
        isLoadingMore.value = false
      }
    } catch (err) {
      loadMoreError.value = feedErrorText(err)
      isLoadingMore.value = false
    }
  }

  /** Повтор последней неудавшейся догрузки страницы. */
  const retryLoadMore = async (): Promise<void> => {
    if (isLoadingMore.value) return
    loadMoreError.value = null
    await loadMore()
  }

  /**
   * Перезагружает ленту С ГОЛОВЫ. Кнопка «Обновить ленту» и WS-подтверждение
   * раньше дёргали `refetch()` напрямую — а он повторяет ТЕКУЩУЮ страницу N,
   * из-за чего только что подтверждённый пост не появлялся до перезагрузки (S17).
   */
  const refreshFeed = async (): Promise<void> => {
    feedGeneration.value += 1
    currentTxidForQuery.value = ''
    lastTxid.value = ''
    hasMore.value = true
    isLoadingMore.value = false
    loadMoreError.value = null
    newPostsCount.value = 0
    await refetch()
  }

  // «Новые посты сразу» (filtersStore.liveFeed): пост попадает в ленту ноды с
  // блоком (в Pocketnet — около минуты), поэтому голову ленты спрашиваем сразу
  // после нового блока (событие WebSocket прокси) и, на случай если сокета нет,
  // раз в LIVE_INTERVAL. Новые посты встают наверх все сразу: раньше — по
  // одному через полторы секунды, и пачка из блока «капала» ещё долго. Только
  // в лентах по дате: в «Лучшем» и «Обсуждаемом» наверху не новое. Новых
  // больше, чем на LIVE_MAX_PAGES страницах (лента долго стояла в фоне), —
  // пилюля, как без режима: иначе между ними и показанным осталась бы дыра.
  const LIVE_INTERVAL = 30_000
  /** После блока нода успевает разложить его посты по лентам. */
  const LIVE_BLOCK_DELAY = 2_000
  const LIVE_MAX_PAGES = 3
  const liveMode = computed<boolean>(
    () =>
      filtersStore.liveFeed &&
      !filtersStore.topFirst &&
      LIVE_TABS.has(Number(filtersStore.activeTab))
  )
  let liveChecking = false
  let liveTimer: ReturnType<typeof setInterval> | null = null
  let liveBlockTimer: ReturnType<typeof setTimeout> | null = null
  let stopBlockWatch: (() => void) | null = null
  /** Когда голову спрашивали последний раз — опрос по таймеру не дублирует проверку по блоку. */
  let lastLiveCheck = 0

  /** Сколько постов брать с головы ленты за запрос, проверяя новые. */
  const NEW_POSTS_PEEK = 20
  // На редком языке голову ищем перебором до ~10 с на ноде (date-feed.ts) —
  // не чаще раза в пять минут, и с пилюлей, и в «Новых постах сразу».
  const SPARSE_HEAD_GAP = 300_000
  let lastSparseHeadCheck = 0
  /** Пора ли снова спрашивать голову ленты; на редком языке — реже. */
  function headCheckDue(): boolean {
    if (!sparse.value) return true
    if (Date.now() - lastSparseHeadCheck < SPARSE_HEAD_GAP) return false
    lastSparseHeadCheck = Date.now()
    return true
  }

  interface NewPosts {
    /** От свежего к старому. */
    posts: AdaptedPost[]
    contents: GetHierarchicalStripPost[]
    /** Дошли до уже показанного поста; false — новых больше, чем просмотрели страниц. */
    complete: boolean
  }

  /**
   * Посты новее показанных: от головы ленты страницами, пока не встретится
   * уже показанный. Высота — текущая (0): у первой страницы она прежняя, и
   * постов новее неё нода бы не отдала. Ленту не меняет.
   */
  async function collectNewPosts(maxPages: number): Promise<NewPosts> {
    const known = new Set(allPosts.value.map((p) => String(p.id)))
    const result: NewPosts = { posts: [], contents: [], complete: true }
    let cursor = ''
    for (let i = 0; i < maxPages; i++) {
      // Без прыжка через перерыв: за ним старые посты, а не новые.
      const page = await fetchFeedPage({ ...feedContext(cursor, NEW_POSTS_PEEK), height: 0 }, false)
      const list = extractPostsFromResponse(page.response)
      for (const post of list) {
        if (known.has(String(post.id))) return result
        result.posts.push(post)
      }
      const raw = page.response?.data?.contents ?? []
      result.contents.push(...raw)
      cursor = raw[raw.length - 1]?.txid ?? ''
      if (list.length < page.requested || !cursor) return result
    }
    result.complete = false
    return result
  }

  /**
   * Фоновая проверка «появились ли новые посты сверху» — для пилюли со
   * счётчиком (`newPostsCount`). Ленту не меняет. В режиме «Новые посты
   * сразу» вместо неё checkLive.
   */
  // Возврат в окно или приложение тоже проверяет, но не чаще раза в минуту:
  // раньше лента запрашивалась на каждом переключении. В фоне не проверяем —
  // пилюлю там никто не видит, а телефон тратит сеть и батарею.
  const NEW_POSTS_MIN_GAP = 60_000
  const checkForNewPosts = async (): Promise<void> => {
    if (liveMode.value || !enabled || isLoading.value || isLoadingMore.value) return
    if (typeof document !== 'undefined' && document.hidden) return
    if (Date.now() - lastNewPostsCheck < NEW_POSTS_MIN_GAP) return
    if (!allPosts.value.length || !headCheckDue()) return
    lastNewPostsCheck = Date.now()
    try {
      newPostsCount.value = (await collectNewPosts(1)).posts.length
    } catch {
      // Тихо игнорируем — фоновая проверка не должна шуметь.
    }
  }

  /** Применяет новые посты: перезагружает голову ленты и сбрасывает счётчик. */
  const showNewPosts = async (): Promise<void> => {
    await refreshFeed()
  }

  const checkLive = async (): Promise<void> => {
    if (!liveMode.value || !enabled || liveChecking || isLoading.value) return
    if (typeof document !== 'undefined' && document.hidden) return
    if (!allPosts.value.length || !headCheckDue()) return
    const generation = feedGeneration.value
    liveChecking = true
    lastLiveCheck = Date.now()
    try {
      const fresh = await collectNewPosts(LIVE_MAX_PAGES)
      if (generation !== feedGeneration.value || !liveMode.value) return
      if (!fresh.complete) {
        newPostsCount.value = fresh.posts.length
        return
      }
      if (!fresh.posts.length) return
      await fetchAndMergeRepostOriginals(fresh.posts, fresh.contents)
      await preloadLastCommentAuthors(fresh.contents)
      if (generation !== feedGeneration.value) return
      // Пока шла догрузка, лента могла получить те же посты другим путём.
      const shown = new Set(allPosts.value.map((p) => String(p.id)))
      const added = fresh.posts.filter((p) => !shown.has(String(p.id)))
      if (!added.length) return
      allPosts.value = [...added, ...allPosts.value]
      if (authStore.address) enrichWithUserScores(added, allPosts.value, authStore.address)
    } catch {
      // Не вышло — спросим в следующий раз; фоновая проверка не шумит.
    } finally {
      liveChecking = false
    }
  }

  function stopLive(): void {
    if (liveTimer) clearInterval(liveTimer)
    liveTimer = null
    if (liveBlockTimer) clearTimeout(liveBlockTimer)
    liveBlockTimer = null
    stopBlockWatch?.()
    stopBlockWatch = null
  }

  watch(
    liveMode,
    (on) => {
      stopLive()
      if (!on || typeof window === 'undefined') return
      newPostsCount.value = 0
      // Таймер — запасной путь: только если по блоку давно не спрашивали.
      liveTimer = setInterval(() => {
        if (Date.now() - lastLiveCheck >= LIVE_INTERVAL - 1_000) void checkLive()
      }, LIVE_INTERVAL)
      stopBlockWatch = wsService.on('block', () => {
        if (liveBlockTimer) clearTimeout(liveBlockTimer)
        liveBlockTimer = setTimeout(() => {
          liveBlockTimer = null
          void checkLive()
        }, LIVE_BLOCK_DELAY)
      })
      void checkLive()
    },
    { immediate: true }
  )

  /** Вернулись в окно или приложение — проверить сверху. */
  const onReturn = (): void => {
    if (typeof document !== 'undefined' && document.hidden) return
    void checkForNewPosts()
    void checkLive()
  }

  // Периодическая проверка новых постов + при возврате фокуса на вкладку.
  const NEW_POSTS_INTERVAL = 90_000
  let newPostsTimer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    if (typeof window !== 'undefined') {
      newPostsTimer = setInterval(() => void checkForNewPosts(), NEW_POSTS_INTERVAL)
      window.addEventListener('focus', onReturn)
      document.addEventListener('visibilitychange', onReturn)
    }
  })
  onBeforeUnmount(() => {
    if (newPostsTimer) {
      clearInterval(newPostsTimer)
      newPostsTimer = null
    }
    stopLive()
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  })

  /**
   * Настраивает Intersection Observer для автоматической загрузки
   */
  const setupIntersectionObserver = () => {
    // Очищаем предыдущий observer
    if (intersectionObserver) {
      intersectionObserver.disconnect()
      intersectionObserver = null
    }
    triggerInZone = false

    if (!loadMoreTrigger.value || !hasMore.value) {
      return
    }

    // Создаем Intersection Observer с rootMargin для безопасного расстояния
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          triggerInZone = entry.isIntersecting
          // Если элемент виден и есть еще посты для загрузки
          if (entry.isIntersecting && hasMore.value && !isLoadingMore.value && !isLoading.value) {
            loadMore()
          }
        })
      },
      {
        // rootMargin создает "невидимую зону" перед элементом
        // Когда элемент входит в эту зону, срабатывает callback
        rootMargin: threshold === undefined ? prefetchMargin() : `${threshold}px 0px`,
        threshold: 0, // Срабатывает как только элемент входит в зону
      }
    )

    // Начинаем наблюдение за триггером
    intersectionObserver.observe(loadMoreTrigger.value)
  }

  /**
   * Наблюдатель сообщает только о входе в зону и выходе из неё. Если страница
   * короткая и триггер после неё так и остался в зоне, нового отчёта не будет
   * и лента встанет. Вызывать, когда страница уже на экране.
   */
  const recheckLoadMore = (): void => {
    if (triggerInZone && hasMore.value && !isLoadingMore.value && !isLoading.value) {
      void loadMore()
    }
  }

  /**
   * Очищает Intersection Observer
   */
  const cleanupIntersectionObserver = () => {
    if (intersectionObserver) {
      intersectionObserver.disconnect()
      intersectionObserver = null
    }
  }

  // Настраиваем observer при монтировании и когда меняется trigger
  onMounted(() => {
    nextTick(() => {
      setupIntersectionObserver()
    })
  })

  onBeforeUnmount(() => {
    cleanupIntersectionObserver()
  })

  // Пересоздаем observer при изменении trigger или hasMore
  watch([loadMoreTrigger, hasMore], () => {
    nextTick(() => {
      setupIntersectionObserver()
    })
  })

  // Сбрасываем состояние при изменении enabled
  watch(
    () => enabled,
    (newEnabled) => {
      if (!newEnabled) {
        feedGeneration.value += 1
        allPosts.value = []
        lastTxid.value = ''
        hasMore.value = true
        isLoadingMore.value = false
        loadMoreError.value = null
      }
    }
  )

  // Сбрасываем состояние при переключении табов
  watch(
    () => filtersStore.activeTab,
    () => {
      feedGeneration.value += 1
      allPosts.value = []
      lastTxid.value = ''
      currentTxidForQuery.value = ''
      hasMore.value = true
      isLoadingMore.value = false
      loadMoreError.value = null
      newPostsCount.value = 0
    }
  )

  return {
    /** Все загруженные посты */
    allPosts: computed(() => allPosts.value),
    /** Загружается ли первая порция */
    isLoading,
    /** Ответ по текущему фильтру разобран: до этого «пусто» показывать нельзя */
    hasSettled: computed(() => hasSettled.value),
    /** Загружается ли следующая порция */
    isLoadingMore: computed(() => isLoadingMore.value),
    /** Есть ли ошибка */
    error,
    /** Есть ли еще посты для загрузки */
    hasMore: computed(() => hasMore.value),
    /** Ref для элемента-триггера загрузки */
    loadMoreTrigger,
    /** Ошибка догрузки следующей страницы (лента при этом остаётся на экране) */
    loadMoreError: computed(() => loadMoreError.value),
    /** Функция для ручной загрузки следующей порции */
    loadMore,
    /** Повторить неудавшуюся догрузку страницы */
    retryLoadMore,
    /** Догрузить, если после показанной страницы триггер остался в зоне */
    recheckLoadMore,
    /** Перезагрузка ленты с головы (кнопка «Обновить», подтверждение по WS) */
    refetch: refreshFeed,
    /** Ленту на этом языке нода целыми страницами не собирает — посты приходят по одному. */
    sparse: computed(() => sparse.value),
    /** «Новые посты сразу» действует на этой ленте: новые встают наверх сами. */
    liveMode,
    /** Количество новых постов сверху (lentaunseen-lite); 0 — нет новых. */
    newPostsCount: computed(() => newPostsCount.value),
    /** Показать новые посты: перезагрузить голову ленты + сбросить счётчик. */
    showNewPosts,
  }
}
