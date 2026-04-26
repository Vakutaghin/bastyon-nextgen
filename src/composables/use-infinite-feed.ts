/**
 * Composable для infinite scroll (ленивой загрузки) ленты постов
 *
 * Использует Intersection Observer для определения, когда пользователь
 * приближается к концу ленты, и автоматически загружает следующую порцию постов.
 */

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import { extractPostsFromResponse, mergeRepostContent, type AdaptedPost } from './use-feed'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useFiltersStore } from '@/stores/filters-store'
import { favoritesAPI } from '@/db/apis/favorites-api'

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
  const {
    initialLimit = 20,
    pageSize = 20,
    threshold,
    lang = 'ru',
    enabled = true
  } = options

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
  watch([
    () => filtersStore.activeTab,
    () => filtersStore.timeFilters,
    () => filtersStore.sortFilters,
    () => filtersStore.selectedCategories,
    () => filtersStore.selectedTags,
    () => filtersStore.customCategories // Следим за изменением определений кастомных категорий
  ], () => {
    // Сбрасываем состояние при изменении фильтров
    currentTxidForQuery.value = ''
    hasMore.value = true
    allPosts.value = []
    isLoadingMore.value = false
  }, { deep: true })

  const queryKey = computed(() => [
    'feed',
    'hierarchical-strip-infinite',
    filtersStore.activeTab,
    currentTxidForQuery.value || 'initial',
    filtersStore.selectedCategories,
    filtersStore.selectedTags,
    filtersStore.customCategories // Добавляем кастомные категории в ключ кэша
  ])

  // Запрос данных
  const { data, isLoading, error, refetch } = useQuery<GetHierarchicalStripResponse>({
    queryKey: queryKey,
    queryFn: async () => {
      // Используем актуальное значение currentTxidForQuery внутри функции
      const currentTxid = currentTxidForQuery.value
      const count = currentTxid === '' ? initialLimit : pageSize

      const contentTypes: string[] = []
      if (filtersStore.activeTab === 3) {
        contentTypes.push('video')
      } else if (filtersStore.activeTab === 4) {
        contentTypes.push('audio')
      } else if (filtersStore.activeTab === 5) {
        contentTypes.push('article')
      }

      const categoryTags = filtersStore.selectedCategories.flatMap(id => {
        // Ищем категорию в полном списке (включая кастомные и временные)
        const category = filtersStore.allCategories.find((c: any) => c.id === id)
        return category ? category.tags.map((tag: string) => encodeURIComponent(tag)) : []
      })

      const userSelectedTags = filtersStore.selectedTags.map((tag: string) => encodeURIComponent(tag))

      // Объединяем теги категорий и пользовательские теги в один массив для 4-го параметра (tagsfilter)
      // В API gethierarchicalstrip теги передаются в 4-м параметре (index 4),
      // а не в 8-м (как было ранее ошибочно предположено для пользовательских тегов)
      const allTags = [...categoryTags, ...userSelectedTags]

      // Для вкладки подписок (id: 2) используем специальный метод
      if (filtersStore.activeTab === 2) {
        return getByPRCWithAuth({
          method: rpcEndpoints.getSubscribesFeed,
          parameters: [
            0,
            currentTxid,
            count,
            lang,
            allTags,
            contentTypes,
            [],
            [],
            [],
            "",
            authStore.address || ""
          ],
          cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
          options: {
            ex: true
          },
          state: 1
        }) as Promise<GetHierarchicalStripResponse>
      }

      // Для вкладки избранного (id: 6)
      if (filtersStore.activeTab === 6) {
        const allFavIds = await favoritesAPI.getAllIds()

        let startIndex = 0
        if (currentTxid) {
          const lastIndex = allFavIds.indexOf(currentTxid)
          if (lastIndex !== -1) {
            startIndex = lastIndex + 1
          } else {
            // Если текущий txid не найден (например, пост удален из избранного),
            // останавливаем загрузку, чтобы избежать бесконечного цикла
            return { data: { contents: [] } } as any
          }
        }

        const idsToFetch = allFavIds.slice(startIndex, startIndex + count)

        if (idsToFetch.length === 0) {
          return { data: { contents: [] } } as any
        }

        const result: any = await getByPRCWithAuth({
          method: rpcEndpoints.getRawTransactionWithMessageById,
          parameters: [
            idsToFetch
          ],
          cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
          options: {},
          state: 1
        })

        // Нормализуем результат, так как он может приходить в разных форматах
        // 1. Просто массив постов (если RPC возвращает data напрямую)
        // 2. Объект { result: 'success', data: [...] } (если RPC возвращает обертку)
        // 3. Объект { data: [...] }

        let posts: any[] = []

        if (Array.isArray(result)) {
          posts = result
        } else if (result && typeof result === 'object') {
           if (Array.isArray(result.data)) {
             posts = result.data
           } else if (Array.isArray(result.result)) {
             posts = result.result
           }
        }

        // Сортируем посты в порядке запрошенных ID, чтобы пагинация работала корректно
        if (posts.length > 0) {
          const postsMap = new Map(posts.map((p: any) => [p.txid || p.id, p]))
          posts = idsToFetch.map(id => postsMap.get(id)).filter(p => p !== undefined)
        }

        return {
          data: {
            contents: posts
          }
        } as any
      }

      // Для вкладки обсуждаемого (id: 7) — всегда свежие данные, без кэша
      if (filtersStore.activeTab === 7) {
        return getByPRCWithAuth({
          method: rpcEndpoints.getMostCommentedFeed,
          parameters: [
            0,
            currentTxid,
            count,
            lang,
            allTags,
            contentTypes,
            [],
            [],
            [],
            "",
            1440
          ],
          cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
          options: {
            ex: true,
            cache: false
          },
          state: 1
        }) as Promise<GetHierarchicalStripResponse>
      }

      return getByPRCWithAuth({
        method: rpcEndpoints.getHierarchicalStrip,
        parameters: [
          0, // height
          currentTxid, // txid для пагинации
          count, // count
          lang,
          allTags, // Index 4: Tags filter (categories + user tags)
          contentTypes, // type
          [], // param6
          [], // param7
          [], // Index 8: Reserved / Excluded tags? (Empty now, tags moved to index 4)
          "",
          authStore.address || ""
        ],
        cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
        options: {
          ex: true
        },
        state: 1
      }) as Promise<GetHierarchicalStripResponse>
    },
    enabled: computed(() => enabled && (hasMore.value || currentTxidForQuery.value === '')),
    staleTime: 0,
    gcTime: 0,
  })

  // Обновляем посты при получении данных
  watch(data, async (newData) => {
    if (!newData?.data?.contents) {
      if (newData && currentTxidForQuery.value !== '') {
        // Если получили пустой ответ при загрузке следующей страницы, значит больше нет постов
        hasMore.value = false
        isLoadingMore.value = false
      }
      return
    }

    let newPosts: AdaptedPost[] = extractPostsFromResponse(newData)
    const contents = newData.data.contents

    // Подгружаем контент оригинальных записей для репостов
    const repostTxids = [...new Set(
      contents
        .filter((p: any) => p.repost)
        .map((p: any) => p.repost)
    )] as string[]
    if (repostTxids.length > 0) {
      try {
        const result: any = await getByPRCWithAuth({
          method: rpcEndpoints.getRawTransactionWithMessageById,
          parameters: [repostTxids],
          cachehash: Date.now().toString(36) + Math.random().toString(36).slice(2),
          options: {},
          state: 1
        })
        const originals = Array.isArray(result)
          ? result
          : (result?.data ?? result?.result ?? [])
        const originalMap = new Map(
          (Array.isArray(originals) ? originals : []).map((p: any) => [p.txid || p.hash || p.id, p])
        )
        newPosts.forEach((adapted) => {
          if (!adapted.repost) return
          const orig = originalMap.get(adapted.repost)
          if (orig) mergeRepostContent(adapted, orig)
        })
      } catch (err) {
        console.error('[useInfiniteFeed] Failed to fetch repost content:', err)
      }
    }

    let postsToEnrich: AdaptedPost[] = []

    if (currentTxidForQuery.value === '') {
      // Первая загрузка - заменяем все посты
      allPosts.value = newPosts
      postsToEnrich = newPosts
    } else {
      // Последующие загрузки - добавляем к существующим
      // Фильтруем дубликаты по id/txid
      const existingIds = new Set(allPosts.value.map(p => String(p.id)))
      const uniqueNewPosts = newPosts.filter(p => !existingIds.has(String(p.id)))
      allPosts.value = [...allPosts.value, ...uniqueNewPosts]
      postsToEnrich = uniqueNewPosts
    }

    // Интеграция с getpagescores для получения оценок пользователя
     if (authStore.address && postsToEnrich.length > 0) {
       // Используем txid или hash для запроса, так как API ожидает хеши транзакций
       const postIds = postsToEnrich.map(p => p.txid || p.hash).filter(Boolean) as string[]

       if (postIds.length > 0) {
         // Запускаем асинхронно, не блокируя UI
         getByPRCWithAuth({
           method: rpcEndpoints.getPageScores,
           parameters: [
             postIds,
             authStore.address,
             [] // commentIds
           ],
           cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2)
         }).then((scoresResponse: any) => {
            // Handle various response formats:
            // 1. Direct array: [...]
            // 2. Wrapped in data: { data: [...] }
            // 3. Wrapped in result (JSON-RPC standard): { result: [...] }
            const scores = Array.isArray(scoresResponse)
              ? scoresResponse
              : (scoresResponse?.data || scoresResponse?.result || [])

            if (Array.isArray(scores)) {
              scores.forEach((score: any) => {
                if (score.posttxid && score.value) {
                  // Ищем в allPosts.value по txid или hash
                  const post = allPosts.value.find(p => p.txid === score.posttxid || p.hash === score.posttxid)
                  if (post) {
                    post.myVal = score.value
                  }
                }
              })
            }
         }).catch(err => {
           console.error('Failed to fetch scores:', err)
         })
       }
     }

    // Обновляем lastTxid для следующей загрузки
    if (contents.length > 0) {
      const lastPost = contents[contents.length - 1]
      const newLastTxid = lastPost?.txid || ''

      // Если получили меньше постов, чем запрашивали, значит это последняя страница
      const expectedCount = currentTxidForQuery.value === '' ? initialLimit : pageSize
      hasMore.value = contents.length >= expectedCount && newLastTxid !== currentTxidForQuery.value

      if (hasMore.value) {
        lastTxid.value = newLastTxid
      }
    } else {
      hasMore.value = false
    }

    isLoadingMore.value = false
  }, { immediate: true })

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
        threshold: 0 // Срабатывает как только элемент входит в зону
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
  watch(() => enabled, (newEnabled) => {
    if (!newEnabled) {
      allPosts.value = []
      lastTxid.value = ''
      hasMore.value = true
      isLoadingMore.value = false
    }
  })

  // Сбрасываем состояние при переключении табов
  watch(() => filtersStore.activeTab, () => {
    allPosts.value = []
    lastTxid.value = ''
    currentTxidForQuery.value = ''
    hasMore.value = true
    isLoadingMore.value = false
  })

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
    refetch
  }
}
