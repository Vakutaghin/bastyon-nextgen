import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getByPRCWithAuth } from '@/helpers/api/request'
import type { GetProfileFeedResponse } from '@/types/rpc-responses/get-profile-feed'
import { extractPostsFromResponse } from '@/composables/use-feed'

/**
 * Параметры для useProfileFeed
 */
export interface UseProfileFeedOptions {
  address: string
  initialLimit?: number
  pageSize?: number
  threshold?: number
  lang?: string
}

/**
 * Infinite scroll для ленты профиля
 */
export function useProfileFeed(options: UseProfileFeedOptions) {
  const {
    address,
    initialLimit = 10,
    pageSize = 10,
    threshold,
    lang = 'ru'
  } = options

  // Безопасное расстояние для подгрузки
  const safeDistance = threshold ?? (typeof window !== 'undefined' ? window.innerHeight : 1000)

  const allPosts = ref<ReturnType<typeof extractPostsFromResponse>>([])
  const userProfile = ref<any>(null)
  const lastTxid = ref<string>('')
  const hasMore = ref(true)
  const isLoadingMore = ref(false)
  const loadMoreTrigger = ref<HTMLElement | null>(null)
  let intersectionObserver: IntersectionObserver | null = null

  // Текущий txid для запроса
  const currentTxidForQuery = ref<string>('')

  const queryKey = computed(() => [
    'feed',
    'profile',
    address,
    currentTxidForQuery.value || 'initial'
  ])

  const { data, isLoading, error, refetch } = useQuery<GetProfileFeedResponse>({
    queryKey: queryKey,
    queryFn: async () => {
      const currentTxid = currentTxidForQuery.value
      const count = currentTxid === '' ? initialLimit : pageSize

      return getByPRCWithAuth({
        method: 'getprofilefeed',
        parameters: [
          0,              // height
          currentTxid,    // txid
          count,          // count
          lang,           // lang
          [],             // tagsfilter
          [],             // type
          [],             // _param6
          [],             // _param7
          [],             // tagsexcluded
          '',             // _param9 (reserved)
          address,        // address
          '',             // keyword
          '',             // orderby
          'desc'          // ascdesc
        ],
        cachehash: Date.now().toString(36) + Math.random().toString(36).substr(2),
        options: {
          ex: true
        }
      }) as Promise<GetProfileFeedResponse>
    },
    staleTime: 0, // Не кешируем, чтобы всегда получать свежие данные
    gcTime: 0
  })

  // Обработка ошибок
  watch(error, (newError) => {
    if (newError) {
      isLoadingMore.value = false
    }
  })

  // Обработка полученных данных
  watch(data, (newData) => {
    if (!newData?.data?.contents) {
      if (currentTxidForQuery.value !== '') {
        hasMore.value = false
        isLoadingMore.value = false
      }
      return
    }

    const newPosts = extractPostsFromResponse(newData)
    const contents = newData.data.contents

    // Извлекаем профиль пользователя из ответа
    const profile = contents.find((item: any) => item.name && !item.txid)
    if (profile) {
      userProfile.value = profile
    }

    if (currentTxidForQuery.value === '') {
      allPosts.value = newPosts
    } else {
      const existingIds = new Set(allPosts.value.map(p => String(p.id)))
      const uniqueNewPosts = newPosts.filter(p => !existingIds.has(String(p.id)))
      allPosts.value = [...allPosts.value, ...uniqueNewPosts]
    }

    if (contents.length > 0) {
      // Ищем последний элемент с txid (это должен быть пост)
      // Используем extracted posts чтобы быть уверенным
      const lastPost = newPosts.length > 0 ? newPosts[newPosts.length - 1] : null

      // Или ищем в contents с конца
      let lastContentTxid = ''
      for (let i = contents.length - 1; i >= 0; i--) {
        if ((contents[i] as any).txid) {
          lastContentTxid = (contents[i] as any).txid
          break
        }
      }

      const newLastTxid = lastPost?.txid || lastContentTxid || ''
      const expectedCount = currentTxidForQuery.value === '' ? initialLimit : pageSize

      // Если txid не изменился или пришло меньше чем ожидали - конец
      // Важно: contents может содержать профиль, поэтому сравниваем length с expectedCount
      // Но если постов вообще нет, то скорее всего конец
      if (newLastTxid && newLastTxid !== currentTxidForQuery.value && contents.length >= expectedCount) {
        lastTxid.value = newLastTxid
        hasMore.value = true
      } else {
        hasMore.value = false
      }
    } else {
      hasMore.value = false
    }

    isLoadingMore.value = false
  }, { immediate: true })

  const loadMore = async () => {
    if (isLoadingMore.value || !hasMore.value || isLoading.value) return

    isLoadingMore.value = true
    currentTxidForQuery.value = lastTxid.value
    // await refetch() - удалено, так как изменение currentTxidForQuery автоматически запускает запрос
  }

  const setupIntersectionObserver = () => {
    if (intersectionObserver) {
      intersectionObserver.disconnect()
      intersectionObserver = null
    }

    const componentOrEl = loadMoreTrigger.value
    // Обработка случая, когда ref возвращает компонент, а не элемент
    const el = (componentOrEl as any)?.$el ?? componentOrEl

    if (!el || !(el instanceof Element) || !hasMore.value) return

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && hasMore.value && !isLoadingMore.value && !isLoading.value) {
            loadMore()
          }
        })
      },
      {
        rootMargin: `${safeDistance}px 0px`,
        threshold: 0
      }
    )
    intersectionObserver.observe(el)
  }

  onMounted(() => {
    nextTick(setupIntersectionObserver)
  })

  onBeforeUnmount(() => {
    if (intersectionObserver) {
      intersectionObserver.disconnect()
    }
  })

  watch([loadMoreTrigger, hasMore], () => {
    nextTick(setupIntersectionObserver)
  })

  return {
    allPosts: computed(() => allPosts.value),
    userProfile: computed(() => userProfile.value),
    isLoading,
    isLoadingMore: computed(() => isLoadingMore.value),
    error,
    hasMore: computed(() => hasMore.value),
    loadMoreTrigger,
    loadMore,
    refetch
  }
}
