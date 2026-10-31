/**
 * «Новое от подписок» наверху главной ленты — как в старом клиенте (lenta
 * `includesub`): вошедшему сначала непросмотренные посты тех, на кого он
 * подписан (первая страница `getsubscribesfeed`), потом плашка «Продолжить в
 * ленте подписок» и обычная лента. Просмотренными посты становятся, когда
 * человек пролистал их до плашки (`markSeen`), — при следующей загрузке ленты
 * их наверху уже нет (helpers/content/subscription-highlights).
 *
 * Отдельный запрос, а не часть постраничной ленты: её страницы и «Новые посты»
 * идут по txid общей ленты и от подписок не зависят. Подборка держится, пока
 * ленту не обновят (`refetch`).
 */

import { computed, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { buildSubscriptionsFeedQuery } from './helpers/feed-queries'
import {
  enrichWithUserScores,
  fetchAndMergeRepostOriginals,
  preloadLastCommentAuthors,
} from './helpers/feed-enrichment'
import { extractPostsFromResponse, type AdaptedPost } from './use-feed'
import {
  loadSeen,
  saveSeen,
  unseenPosts,
  widenSeen,
  type SeenRange,
} from '@/helpers/content/subscription-highlights'

/** Сколько постов подписок спрашивать — страница ленты подписок, как у старого клиента. */
const PAGE = 20

export function useSubscriptionHighlights(enabled: () => boolean) {
  const authStore = useAuthStore()
  const address = computed(() => authStore.address || '')
  const active = computed(() => enabled() && !!address.value)

  // Что было просмотрено к показу подборки. Перезапрос сам по себе (после входа
  // приложение перезапрашивает всё) её не меняет: плашка на экране сразу
  // отмечает посты просмотренными, и подборка пропадала через секунду после
  // появления. Новое «просмотрено» действует со следующей загрузки — «Обновить».
  let seenAtShow: { address: string; range: SeenRange | null } | null = null
  const seenFor = (me: string): SeenRange | null => {
    if (seenAtShow?.address !== me) seenAtShow = { address: me, range: loadSeen(me) }
    return seenAtShow.range
  }

  const { data, refetch: refetchQuery } = useQuery<AdaptedPost[]>({
    queryKey: computed(() => ['subscription-highlights', address.value]),
    queryFn: async () => {
      const me = address.value
      const response = await buildSubscriptionsFeedQuery({
        currentTxid: '',
        count: PAGE,
        lang: '',
        allTags: [],
        contentTypes: [],
        userAddress: me,
        topFirst: false,
        depth: 0,
      })
      const contents = response?.data?.contents
      if (!contents?.length) return []
      const posts = unseenPosts(extractPostsFromResponse(response), seenFor(me))
      if (!posts.length) return []
      await preloadLastCommentAuthors(contents)
      await fetchAndMergeRepostOriginals(posts, contents)
      return posts
    },
    enabled: active,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  })

  // Свои оценки — на уже реактивные посты, чтобы звёзды обновились.
  watch(data, (posts) => {
    if (posts?.length && address.value) enrichWithUserScores(posts, posts, address.value)
  })

  const posts = computed<AdaptedPost[]>(() => (active.value ? (data.value ?? []) : []))

  /** Человек пролистал подборку: в следующий раз наверху только новое. */
  function markSeen(): void {
    if (!posts.value.length) return
    saveSeen(address.value, widenSeen(loadSeen(address.value), posts.value))
  }

  /** «Обновить»: просмотренное с прошлого показа больше не наверху. */
  function refetch(): ReturnType<typeof refetchQuery> {
    seenAtShow = null
    return refetchQuery()
  }

  return { posts, refetch, markSeen }
}
