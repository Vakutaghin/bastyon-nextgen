import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCallWithAuth } from '@/helpers/api/request'
import type { GetProfileFeedData } from '@/types/rpc-responses/get-profile-feed'
import type { GetHierarchicalStripPost } from '@/types/rpc-responses/get-hierarchical-strip'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { extractPostsFromResponse, mergeRepostContent } from '@/composables/use-feed'
import type { AdaptedPost } from '@/composables/use-feed'

/** Сырой пост из API с минимальным набором полей, нужных для merge репостов. */
interface RawRepostPost {
  repost?: string
  txid?: string
  hash?: string
  id?: string | number
}

/** Элемент `contents` из getprofilefeed — пост либо профиль пользователя. */
type ProfileFeedItem = GetHierarchicalStripPost | UserProfile

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
  const userProfile = ref<UserProfile | null>(null)
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

  const { data, isLoading, error, refetch } = useQuery<GetProfileFeedData>({
    queryKey: queryKey,
    queryFn: async () => {
      const currentTxid = currentTxidForQuery.value
      const count = currentTxid === '' ? initialLimit : pageSize

      return rpcCallWithAuth<GetProfileFeedData>({
        method: rpcEndpoints.getProfileFeed,
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
        cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
        options: {
          ex: true
        }
      })
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
  watch(data, async (newData) => {
    if (!newData?.contents) {
      if (currentTxidForQuery.value !== '') {
        hasMore.value = false
        isLoadingMore.value = false
      }
      return
    }

    // getprofilefeed возвращает `GetProfileFeedData` (с полем `contents`), которое
    // extractPostsFromResponse читает через ветку `feedData.contents`. Структуры
    // пересекаются лишь частично, поэтому требуется широкое приведение через unknown.
    let newPosts: AdaptedPost[] = extractPostsFromResponse(
      newData as unknown as Parameters<typeof extractPostsFromResponse>[0]
    )
    const contents = newData.contents

    // Подгружаем контент оригинальных записей для репостов
    const repostTxids = [...new Set(
      (contents as RawRepostPost[])
        .filter((p) => p.repost)
        .map((p) => p.repost)
    )] as string[]
    if (repostTxids.length > 0) {
      try {
        const result = await rpcCallWithAuth<RawRepostPost[]>({
          method: rpcEndpoints.getRawTransactionWithMessageById,
          parameters: [repostTxids],
          cachehash: Date.now().toString(36) + Math.random().toString(36).slice(2),
          options: {},
          state: 1
        })
        const originals = Array.isArray(result) ? result : []
        const originalMap = new Map(
          (Array.isArray(originals) ? originals : []).map((p) => [p.txid || p.hash || p.id, p])
        )
        newPosts.forEach((adapted) => {
          if (!adapted.repost) return
          const orig = originalMap.get(adapted.repost)
          if (orig) mergeRepostContent(adapted, orig)
        })
      } catch (err) {
        console.error('[useProfileFeed] Failed to fetch repost content:', err)
      }
    }

    // Извлекаем профиль пользователя из ответа
    const profile = (contents as ProfileFeedItem[]).find(
      (item): item is UserProfile =>
        'name' in item && Boolean(item.name) && !('txid' in item && item.txid)
    )
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
        const item = contents[i] as RawRepostPost
        if (item.txid) {
          lastContentTxid = item.txid
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
    const el = (componentOrEl as { $el?: Element } | null)?.$el ?? componentOrEl

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
