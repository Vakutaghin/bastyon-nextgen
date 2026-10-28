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
 * `shares.users`): фильтр по сумме flags < 10, выбор N продвигаемых случайно, с
 * шансом по сумме буста (`pickBoosted`, как `randomizerarray`), затем добор
 * контента. Сам запрос бустов — `fetchBoostFeed` (services/boost-feed.ts).
 *
 * Выбор держится, пока ленту не обновят (`refetch`): иначе при возврате на
 * главную продвигаемые посты менялись бы под рукой у читающего.
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { fetchBoostFeed } from '@/services/boost-feed'
import { pickBoosted } from '@/helpers/content/boost'
import { useUIStore } from '@/stores/ui-store'
import { extractPostsFromResponse, type AdaptedPost } from './use-feed'
import { preloadLastCommentAuthors } from './helpers/feed-enrichment'

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
  const lang = computed(() => uiStore.contentLanguage)

  const { data, isLoading, error, refetch } = useQuery<unknown[]>({
    queryKey: computed(() => ['boosted-feed', lang.value]),
    queryFn: async () => {
      // 1. Заглушки бустов.
      const boosts = await fetchBoostFeed(lang.value)
      if (boosts.length === 0) return []

      // 2. Фильтр по flags, выбор по сумме буста; порядок выбора — порядок в ленте.
      const txids = pickBoosted(
        boosts.filter((b) => flagsSum(b.flags) < 10 && !!b.txid),
        limit
      ).map((b) => b.txid as string)
      if (txids.length === 0) return []

      // 3. Добор контента по txid (отдаёт полные посты с inline-userprofile).
      const contentResp = (await getByPRC({
        method: rpcEndpoints.getRawTransactionWithMessageById,
        parameters: [txids],
      })) as ContentResponse

      // Удалённый пост нода отдаёт null — без него, а не падение всей подборки.
      const order = (p: unknown) => txids.indexOf(String((p as { txid?: string }).txid ?? ''))
      const contents = Array.isArray(contentResp?.data)
        ? contentResp.data
            .filter((p) => !!p && typeof p === 'object')
            .sort((a, b) => order(a) - order(b))
        : []
      await preloadLastCommentAuthors(contents)
      return contents
    },
    enabled: computed(() => enabled()),
    staleTime: Infinity,
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

  return { posts, isLoading, error, refetch }
}
