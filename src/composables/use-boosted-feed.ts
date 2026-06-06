/**
 * Бустед-лента (`getboostfeed`) — продвигаемые посты, показываются отдельной
 * секцией вверху главной ленты.
 *
 * Сверено с legacy `js/satolist.js` (ветка `mtd == 'getboostfeed'`): параметры
 * `[height=0, txid='', 1440, lang, [], type, [], [], tagsexcluded]` (третий слот —
 * окно буста в минутах, 60*24); ответ содержит посты в `data.boosts`.
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { useUIStore } from '@/stores/ui-store'
import { extractPostsFromResponse, type AdaptedPost } from './use-feed'

/** Окно буста в минутах (legacy `60 * 24`). */
const BOOST_WINDOW_MINUTES = 60 * 24

interface BoostResponse {
  data?: { boosts?: unknown[]; users?: unknown[] }
  boosts?: unknown[]
}

/**
 * @param limit сколько продвигаемых постов показать.
 * @param enabled включён ли запрос (например, только на главной вкладке).
 */
export function useBoostedFeed(limit = 3, enabled: () => boolean = () => true) {
  const uiStore = useUIStore()
  const lang = computed(() => uiStore.language)

  const { data, isLoading, error } = useQuery<BoostResponse>({
    queryKey: computed(() => ['boosted-feed', lang.value]),
    queryFn: () =>
      getByPRC({
        method: rpcEndpoints.getBoostFeed,
        parameters: [0, '', BOOST_WINDOW_MINUTES, lang.value, [], [], [], [], []],
        cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
        options: { ex: true },
      }) as Promise<BoostResponse>,
    enabled: computed(() => enabled()),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const posts = computed<AdaptedPost[]>(() => {
    const resp = data.value
    const boosts = resp?.data?.boosts ?? resp?.boosts
    if (!Array.isArray(boosts) || boosts.length === 0) return []
    const users = resp?.data?.users
    // extractPostsFromResponse читает data.contents (+ data.users для авторов/видео).
    const adapted = extractPostsFromResponse({
      data: { contents: boosts, users: Array.isArray(users) ? users : [] },
    } as unknown as Parameters<typeof extractPostsFromResponse>[0])
    return adapted.slice(0, limit)
  })

  return { posts, isLoading, error }
}
