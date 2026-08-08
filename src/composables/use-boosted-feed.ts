/**
 * Бустед-лента (`getboostfeed`) — продвигаемые посты, показываются отдельной
 * секцией вверху главной ленты.
 *
 * ВАЖНО: `getboostfeed` возвращает только ЗАГЛУШКИ бустов
 * (`{id, txid, txtype, boost, boosted, flags}`) — без контента и автора. Чтобы
 * показать пост, нужен второй запрос контента по txid через
 * `getrawtransactionwithmessagebyid` (он отдаёт полный пост с inline-userprofile).
 *
 * Сверено с legacy `js/satolist.js` (`getboostfeed` → `shares.getbyid(txids)` →
 * `shares.users`): фильтр по сумме flags < 10, выбор N продвигаемых, затем добор
 * контента. Параметры getboostfeed: `[height=0, txid='', 1440(окно, мин), lang, …]`.
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { useUIStore } from '@/stores/ui-store'
import { extractPostsFromResponse, type AdaptedPost } from './use-feed'

/** Окно буста в минутах (legacy `60 * 24`). */
const BOOST_WINDOW_MINUTES = 60 * 24

/** Заглушка буста из getboostfeed. */
interface BoostStub {
  txid?: string
  boost?: number
  flags?: Record<string, number>
}

interface BoostResponse {
  data?: { boosts?: BoostStub[] }
  boosts?: BoostStub[]
}

interface ContentResponse {
  data?: unknown[]
}

/** Сумма значений flags (legacy: бусты с суммой ≥ 10 скрываются). */
function flagsSum(flags: Record<string, number> | undefined): number {
  if (!flags) return 0
  return Object.values(flags).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0)
}

/**
 * @param limit сколько продвигаемых постов показать.
 * @param enabled включён ли запрос (например, только на главной вкладке).
 */
export function useBoostedFeed(limit = 3, enabled: () => boolean = () => true) {
  const uiStore = useUIStore()
  const lang = computed(() => uiStore.language)

  const { data, isLoading, error } = useQuery<unknown[]>({
    queryKey: computed(() => ['boosted-feed', lang.value]),
    queryFn: async () => {
      // 1. Заглушки бустов.
      const boostResp = (await getByPRC({
        method: rpcEndpoints.getBoostFeed,
        parameters: [0, '', BOOST_WINDOW_MINUTES, lang.value, [], [], [], [], []],
        cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
        options: { ex: true },
      })) as BoostResponse

      const boosts = boostResp?.data?.boosts ?? boostResp?.boosts
      if (!Array.isArray(boosts) || boosts.length === 0) return []

      // 2. Фильтр по flags + выбор самых продвигаемых, собираем txid'ы.
      const txids = boosts
        .filter((b) => flagsSum(b.flags) < 10)
        .sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0))
        .map((b) => b.txid)
        .filter((t): t is string => !!t)
        .slice(0, limit)
      if (txids.length === 0) return []

      // 3. Добор контента по txid (отдаёт полные посты с inline-userprofile).
      const contentResp = (await getByPRC({
        method: rpcEndpoints.getRawTransactionWithMessageById,
        parameters: [txids],
      })) as ContentResponse

      return Array.isArray(contentResp?.data) ? contentResp.data : []
    },
    enabled: computed(() => enabled()),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const posts = computed<AdaptedPost[]>(() => {
    const contents = data.value
    if (!Array.isArray(contents) || contents.length === 0) return []
    // extractPostsFromResponse читает data.contents; userprofile у каждого поста inline.
    const adapted = extractPostsFromResponse({
      data: { contents },
    } as unknown as Parameters<typeof extractPostsFromResponse>[0])
    return adapted.slice(0, limit)
  })

  return { posts, isLoading, error }
}
