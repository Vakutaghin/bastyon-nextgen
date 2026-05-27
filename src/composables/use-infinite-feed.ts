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
import { buildFeedQueryByTab } from './helpers/feed-queries'
import { fetchAndMergeRepostOriginals, enrichWithUserScores } from './helpers/feed-enrichment'

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
  /** Язык контента */
  lang?: string
  /** Включен ли запрос */
  enabled?: boolean
}

/**
 * Infinite scroll для hierarchical strip

 */
export function useInfiniteFeed(options: UseInfiniteFeedOptions = {}) {
  const { initialLimit = 20, pageSize = 20, threshold, lang = 'ru', enabled = true } = options

  const authStore = useAuthStore()
  const filtersStore = useFiltersStore()

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

  // Следим за изменениями фильтров
  watch(
    [
      () => filtersStore.activeTab,
      () => filtersStore.timeFilters,
      () => filtersStore.sortFilters,
      () => filtersStore.selectedCategories,
      () => filtersStore.selectedTags,
      () => filtersStore.customCategories, // Следим за изменением определений кастомных категорий
    ],
    () => {
      // Сбрасываем состояние при изменении фильтров
      currentTxidForQuery.value = ''
      hasMore.value = true
      allPosts.value = []
      isLoadingMore.value = false
    },
    { deep: true }
  )

  const queryKey = computed(() => [
    'feed',
    'hierarchical-strip-infinite',
    filtersStore.activeTab,
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
      const category = filtersStore.allCategories.find((c: any) => c.id === id)
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
        lang,
        allTags: buildAllTags(),
        contentTypes: buildContentTypes(),
        userAddress: authStore.address || '',
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
      if (!newData?.data?.contents) {
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

      let postsToEnrich: AdaptedPost[]
      if (currentTxidForQuery.value === '') {
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
        const expectedCount = currentTxidForQuery.value === '' ? initialLimit : pageSize
        hasMore.value =
          contents.length >= expectedCount && newLastTxid !== currentTxidForQuery.value

        if (hasMore.value) {
          lastTxid.value = newLastTxid
        }
      } else {
        hasMore.value = false
      }

      isLoadingMore.value = false
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

    try {
      // Обновляем txid для следующего запроса
      currentTxidForQuery.value = lastTxid.value
      // Обновляем query key, что заставит useQuery выполнить новый запрос
      await refetch()
    } catch (err) {
      console.error('Failed to load more posts:', err)
      isLoadingMore.value = false
    }
  }

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
        allPosts.value = []
        lastTxid.value = ''
        hasMore.value = true
        isLoadingMore.value = false
      }
    }
  )

  // Сбрасываем состояние при переключении табов
  watch(
    () => filtersStore.activeTab,
    () => {
      allPosts.value = []
      lastTxid.value = ''
      currentTxidForQuery.value = ''
      hasMore.value = true
      isLoadingMore.value = false
    }
  )

  return {
    /** Все загруженные посты */
    allPosts: computed(() => allPosts.value),
    /** Загружается ли первая порция */
    isLoading,
    /** Загружается ли следующая порция */
    isLoadingMore: computed(() => isLoadingMore.value),
    /** Есть ли ошибка */
    error,
    /** Есть ли еще посты для загрузки */
    hasMore: computed(() => hasMore.value),
    /** Ref для элемента-триггера загрузки */
    loadMoreTrigger,
    /** Функция для ручной загрузки следующей порции */
    loadMore,
    /** Функция для перезагрузки ленты */
    refetch,
  }
}
