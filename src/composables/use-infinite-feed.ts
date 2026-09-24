/**
 * Composable для infinite scroll (ленивой загрузки) ленты постов
 *
 * Использует Intersection Observer для определения, когда пользователь
 * приближается к концу ленты, и автоматически загружает следующую порцию постов.
 */

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import { extractPostsFromResponse, type AdaptedPost } from './use-feed'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useFiltersStore } from '@/stores/filters-store'
import { useUIStore } from '@/stores/ui-store'
import { buildFeedQueryByTab } from './helpers/feed-queries'
import { fetchAndMergeRepostOriginals, enrichWithUserScores } from './helpers/feed-enrichment'
import { extractErrorMessage } from '@/helpers/common/extract-error-message'

/**
 * Параметры для useInfiniteFeed
 */
export interface UseInfiniteFeedOptions {
  /** Начальное количество постов для первой загрузки */
  initialLimit?: number
  /** Количество постов для каждой последующей загрузки */
  pageSize?: number
  /** Безопасное расстояние до конца в пикселях (по умолчанию 100vh) */
  threshold?: number
  /** Язык контента. Если не задан — берётся реактивно из ui-store (язык приложения). */
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

  // Язык контента: явно переданный (options.lang) приоритетнее, иначе — язык
  // приложения из ui-store (legacy брал `app.localization.key`). Реактивен:
  // смена языка интерфейса перезагружает ленту.
  const lang = computed(() => options.lang ?? uiStore.language)

  onMounted(() => {
    if (!filtersStore.isInitialized) {
      filtersStore.init()
    }
  })

  // Вычисляем безопасное расстояние (100vh по умолчанию)
  const safeDistance = threshold ?? (typeof window !== 'undefined' ? window.innerHeight : 1000)

  // Состояние пагинации
  const allPosts = ref<ReturnType<typeof extractPostsFromResponse>>([])
  const lastTxid = ref<string>('')
  const hasMore = ref(true)
  const isLoadingMore = ref(false)
  const loadMoreTrigger = ref<HTMLElement | null>(null)
  let intersectionObserver: IntersectionObserver | null = null

  // Отслеживаем текущий txid для запроса
  const currentTxidForQuery = ref<string>('')

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
  const buildAllTags = (): string[] => {
    const categoryTags = filtersStore.selectedCategories.flatMap((id) => {
      const category = filtersStore.allCategories.find((c) => c.id === id)
      return category ? category.tags.map((tag: string) => encodeURIComponent(tag)) : []
    })
    const userSelectedTags = filtersStore.selectedTags.map((tag: string) => encodeURIComponent(tag))
    return [...categoryTags, ...userSelectedTags]
  }

  // Запрос данных — все варианты вкладок диспатчатся в buildFeedQueryByTab.
  const { data, isLoading, error, refetch } = useQuery<GetHierarchicalStripResponse>({
    queryKey: queryKey,
    queryFn: async () => {
      const currentTxid = currentTxidForQuery.value
      return buildFeedQueryByTab(filtersStore.activeTab, {
        currentTxid,
        count: currentTxid === '' ? initialLimit : pageSize,
        lang: lang.value,
        allTags: buildAllTags(),
        contentTypes: buildContentTypes(),
        userAddress: authStore.address || '',
        topFirst: filtersStore.topFirst,
        depth: filtersStore.topFeedDepth,
      })
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
      if (requestedTxid === '') {
        // Первая загрузка — заменяем все посты.
        allPosts.value = newPosts
        postsToEnrich = newPosts
      } else {
        // Последующие — добавляем к существующим, фильтруя дубликаты по id.
        const existingIds = new Set(allPosts.value.map((p) => String(p.id)))
        const uniqueNewPosts = newPosts.filter((p) => !existingIds.has(String(p.id)))
        allPosts.value = [...allPosts.value, ...uniqueNewPosts]
        postsToEnrich = uniqueNewPosts
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
        const expectedCount = requestedTxid === '' ? initialLimit : pageSize
        hasMore.value = contents.length >= expectedCount && newLastTxid !== requestedTxid

        if (hasMore.value) {
          lastTxid.value = newLastTxid
        }
      } else {
        hasMore.value = false
      }

      loadMoreError.value = null
      isLoadingMore.value = false
      hasSettled.value = true
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
        loadMoreError.value = extractErrorMessage(result.error)
        isLoadingMore.value = false
      }
    } catch (err) {
      loadMoreError.value = extractErrorMessage(err)
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

  /**
   * Фоновая проверка «появились ли новые посты сверху». Тянет голову ленты тем же
   * запросом (currentTxid='') и считает, сколько постов идёт ПЕРЕД текущей головой.
   * Не мутирует ленту — только обновляет `newPostsCount` для пилюли.
   */
  const NEW_POSTS_PEEK = 20
  const checkForNewPosts = async (): Promise<void> => {
    if (!enabled || isLoading.value || isLoadingMore.value) return
    const headId = String(allPosts.value[0]?.id ?? '')
    if (!headId) return
    try {
      const resp = await buildFeedQueryByTab(filtersStore.activeTab, {
        currentTxid: '',
        count: NEW_POSTS_PEEK,
        lang: lang.value,
        allTags: buildAllTags(),
        contentTypes: buildContentTypes(),
        userAddress: authStore.address || '',
        topFirst: filtersStore.topFirst,
        depth: filtersStore.topFeedDepth,
      })
      const fresh = extractPostsFromResponse(resp)
      if (!fresh.length) return
      const idx = fresh.findIndex((p) => String(p.id) === headId)
      newPostsCount.value = idx === -1 ? fresh.length : idx
    } catch {
      // Тихо игнорируем — фоновая проверка не должна шуметь.
    }
  }

  /** Применяет новые посты: перезагружает голову ленты и сбрасывает счётчик. */
  const showNewPosts = async (): Promise<void> => {
    await refreshFeed()
  }

  // Периодическая проверка новых постов + при возврате фокуса на вкладку.
  const NEW_POSTS_INTERVAL = 90_000
  let newPostsTimer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    if (typeof window !== 'undefined') {
      newPostsTimer = setInterval(() => void checkForNewPosts(), NEW_POSTS_INTERVAL)
      window.addEventListener('focus', checkForNewPosts)
    }
  })
  onBeforeUnmount(() => {
    if (newPostsTimer) {
      clearInterval(newPostsTimer)
      newPostsTimer = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', checkForNewPosts)
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

    if (!loadMoreTrigger.value || !hasMore.value) {
      return
    }

    // Создаем Intersection Observer с rootMargin для безопасного расстояния
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Если элемент виден и есть еще посты для загрузки
          if (entry.isIntersecting && hasMore.value && !isLoadingMore.value && !isLoading.value) {
            loadMore()
          }
        })
      },
      {
        // rootMargin создает "невидимую зону" перед элементом
        // Когда элемент входит в эту зону, срабатывает callback
        rootMargin: `${safeDistance}px 0px`,
        threshold: 0, // Срабатывает как только элемент входит в зону
      }
    )

    // Начинаем наблюдение за триггером
    intersectionObserver.observe(loadMoreTrigger.value)
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
    /** Перезагрузка ленты с головы (кнопка «Обновить», подтверждение по WS) */
    refetch: refreshFeed,
    /** Количество новых постов сверху (lentaunseen-lite); 0 — нет новых. */
    newPostsCount: computed(() => newPostsCount.value),
    /** Показать новые посты: перезагрузить голову ленты + сбросить счётчик. */
    showNewPosts,
  }
}
