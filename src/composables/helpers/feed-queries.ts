// Построение RPC-запросов для разных типов ленты (вкладок): обычная hierarchical strip,
// подписки, избранное, обсуждаемое. Чистые функции без Vue-реактивности — принимают
// контекст и возвращают Promise<GetHierarchicalStripResponse>.

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { favoritesAPI } from '@/db/apis/favorites-api'
import type {
  GetHierarchicalStripResponse,
  GetHierarchicalStripPost,
} from '@/types/rpc-responses/get-hierarchical-strip'

/** Сырой пост из RPC getrawtransactionwithmessagebyid (минимум полей для сортировки). */
type RawFavoritePost = Partial<GetHierarchicalStripPost> & {
  txid?: string
  id?: string | number
}

/** Возможные обёртки RPC-ответа: голый массив либо `{ data }` / `{ result }`. */
interface RpcArrayEnvelope<T> {
  data?: T[]
  result?: T[]
}

/** Контекст одного запроса ленты — собран наружу из useInfiniteFeed. */
export interface FeedQueryContext {
  currentTxid: string
  count: number
  lang: string
  allTags: string[]
  contentTypes: string[]
  userAddress: string
  /** Режим «Сначала лучшее»: дефолтная лента идёт через `gettopfeed`. */
  topFirst: boolean
  /** Окно (в днях) для `gettopfeed` — берётся из активного фильтра времени. */
  depth: number
}

/** Уникальный cachehash чтобы обойти серверный кэш для свежих данных. */
const freshCacheHash = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substring(2)

/** Default-вкладка: gethierarchicalstrip. */
export async function buildHierarchicalStripQuery(
  ctx: FeedQueryContext
): Promise<GetHierarchicalStripResponse> {
  return getByPRCWithAuth({
    method: rpcEndpoints.getHierarchicalStrip,
    parameters: [
      0,
      ctx.currentTxid,
      ctx.count,
      ctx.lang,
      ctx.allTags,
      ctx.contentTypes,
      [],
      [],
      [],
      '',
      ctx.userAddress,
    ],
    cachehash: freshCacheHash(),
    options: { ex: true },
    state: 1,
  }) as Promise<GetHierarchicalStripResponse>
}

/**
 * Лента «Лучшее» (`gettopfeed`) — включается тогглом «Сначала лучшее» (topFirst)
 * на дефолтной/контентных вкладках. Сигнатура 1:1 с legacy: базовые параметры
 * hierarchical-strip + `['', depth]` (см. `js/satolist.js`, ветка
 * `if (mtd == 'gettopfeed')`). `depth` — окно в днях. Поддерживает txid-пагинацию.
 */
export async function buildTopFeedQuery(
  ctx: FeedQueryContext
): Promise<GetHierarchicalStripResponse> {
  return getByPRCWithAuth({
    method: rpcEndpoints.getTopFeed,
    parameters: [
      0,
      ctx.currentTxid,
      ctx.count,
      ctx.lang,
      ctx.allTags,
      ctx.contentTypes,
      [],
      [],
      [],
      '',
      ctx.depth,
    ],
    cachehash: freshCacheHash(),
    options: { ex: true },
    state: 1,
  }) as Promise<GetHierarchicalStripResponse>
}

/** Вкладка «Подписки»: getsubscribesfeed. */
export async function buildSubscriptionsFeedQuery(
  ctx: FeedQueryContext
): Promise<GetHierarchicalStripResponse> {
  return getByPRCWithAuth({
    method: rpcEndpoints.getSubscribesFeed,
    parameters: [
      0,
      ctx.currentTxid,
      ctx.count,
      ctx.lang,
      ctx.allTags,
      ctx.contentTypes,
      [],
      [],
      [],
      '',
      ctx.userAddress,
    ],
    cachehash: freshCacheHash(),
    options: { ex: true },
    state: 1,
  }) as Promise<GetHierarchicalStripResponse>
}

/**
 * Вкладка «Обсуждаемое»: getmostcommentedfeed. Всегда свежие данные (cache: false),
 * окно 1440 минут (24ч).
 */
export async function buildMostCommentedFeedQuery(
  ctx: FeedQueryContext
): Promise<GetHierarchicalStripResponse> {
  return getByPRCWithAuth({
    method: rpcEndpoints.getMostCommentedFeed,
    parameters: [
      0,
      ctx.currentTxid,
      ctx.count,
      ctx.lang,
      ctx.allTags,
      ctx.contentTypes,
      [],
      [],
      [],
      '',
      1440,
    ],
    cachehash: freshCacheHash(),
    options: { ex: true, cache: false },
    state: 1,
  }) as Promise<GetHierarchicalStripResponse>
}

/**
 * Вкладка «Избранное»: список id из локального IDB → батч-загрузка по hash.
 * Поддерживает пагинацию по currentTxid (последний загруженный из локального списка).
 * Возвращает пустой contents если currentTxid не найден или список закончился.
 */
export async function buildFavoritesFeedQuery(
  ctx: FeedQueryContext
): Promise<GetHierarchicalStripResponse> {
  const allFavIds = await favoritesAPI.getAllIds()

  let startIndex = 0
  if (ctx.currentTxid) {
    const lastIndex = allFavIds.indexOf(ctx.currentTxid)
    if (lastIndex === -1) {
      // Пост был удалён из избранного — останавливаем загрузку, иначе бесконечный цикл.
      return favoritesResponse([])
    }
    startIndex = lastIndex + 1
  }

  const idsToFetch = allFavIds.slice(startIndex, startIndex + ctx.count)
  if (idsToFetch.length === 0) {
    return favoritesResponse([])
  }

  const result = (await getByPRCWithAuth({
    method: rpcEndpoints.getRawTransactionWithMessageById,
    parameters: [idsToFetch],
    cachehash: freshCacheHash(),
    options: {},
    state: 1,
  })) as RawFavoritePost[] | RpcArrayEnvelope<RawFavoritePost>

  // RPC может вернуть результат в разных форматах: голый массив / {data} / {result}.
  let posts: RawFavoritePost[] = []
  if (Array.isArray(result)) {
    posts = result
  } else if (result && typeof result === 'object') {
    if (Array.isArray(result.data)) posts = result.data
    else if (Array.isArray(result.result)) posts = result.result
  }

  // Сортируем посты в порядке запрошенных ID для корректной пагинации.
  if (posts.length > 0) {
    const postsMap = new Map(posts.map((p) => [p.txid || p.id, p]))
    posts = idsToFetch
      .map((id) => postsMap.get(id))
      .filter((p): p is RawFavoritePost => p !== undefined)
  }

  return favoritesResponse(posts)
}

/**
 * Строит частичный {@link GetHierarchicalStripResponse} для вкладки «Избранное».
 * Потребитель ({@link extractPostsFromResponse}) читает только `data.contents`,
 * поэтому остальные поля ответа опускаются.
 */
function favoritesResponse(posts: RawFavoritePost[]): GetHierarchicalStripResponse {
  return {
    data: { contents: posts as GetHierarchicalStripPost[] },
  } as GetHierarchicalStripResponse
}

/**
 * Диспетчер запроса по типу вкладки. activeTab id:
 *   2 — подписки, 6 — избранное, 7 — обсуждаемое, остальное — hierarchical strip.
 *
 * На дефолтной и контентных вкладках (1, 3 video, 4 audio, 5 article) тоггл
 * «Сначала лучшее» (`ctx.topFirst`) переключает источник на `gettopfeed` (лента
 * «Лучшее» с окном `ctx.depth`). Выделенные вкладки (подписки/избранное/обсуждаемое)
 * имеют собственные лоадеры и тоггл на них не влияет.
 */
export async function buildFeedQueryByTab(
  activeTab: number,
  ctx: FeedQueryContext
): Promise<GetHierarchicalStripResponse> {
  if (activeTab === 2) return buildSubscriptionsFeedQuery(ctx)
  if (activeTab === 6) return buildFavoritesFeedQuery(ctx)
  if (activeTab === 7) return buildMostCommentedFeedQuery(ctx)
  if (ctx.topFirst) return buildTopFeedQuery(ctx)
  return buildHierarchicalStripQuery(ctx)
}
