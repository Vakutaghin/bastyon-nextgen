// Функции запросов для каждого типа фида (подписки, избранное, обсуждаемое, дефолт)

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { generateCacheHash } from '@/helpers/common/cache-hash'
import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import { favoritesAPI } from '@/db/apis/favorites-api'

import { MOST_COMMENTED_WINDOW_MINUTES } from './use-infinite-feed-consts'

interface FetchParams {
  currentTxid: string
  count: number
  lang: string
  allTags: string[]
  contentTypes: string[]
  address: string
}

/**
 * Запрос ленты подписок (getSubscribesFeed).
 */
export function fetchSubscribesFeed(params: FetchParams): Promise<GetHierarchicalStripResponse> {
  const { currentTxid, count, lang, allTags, contentTypes, address } = params

  return getByPRCWithAuth({
    method: rpcEndpoints.getSubscribesFeed,
    parameters: [0, currentTxid, count, lang, allTags, contentTypes, [], [], [], '', address],
    cachehash: generateCacheHash(),
    options: { ex: true },
    state: 1,
  }) as Promise<GetHierarchicalStripResponse>
}

/**
 * Запрос ленты избранного — загружает посты по ID из локальной БД.
 */
export async function fetchFavoritesFeed(params: FetchParams): Promise<GetHierarchicalStripResponse> {
  const { currentTxid, count } = params

  const allFavIds = await favoritesAPI.getAllIds()

  let startIndex = 0
  if (currentTxid) {
    const lastIndex = allFavIds.indexOf(currentTxid)
    if (lastIndex !== -1) {
      startIndex = lastIndex + 1
    } else {
      // txid не найден (пост удалён из избранного) — останавливаем загрузку
      return { data: { contents: [] } } as any
    }
  }

  const idsToFetch = allFavIds.slice(startIndex, startIndex + count)
  if (idsToFetch.length === 0) {
    return { data: { contents: [] } } as any
  }

  const result: any = await getByPRCWithAuth({
    method: rpcEndpoints.getRawTransactionWithMessageById,
    parameters: [idsToFetch],
    cachehash: generateCacheHash(),
    options: {},
    state: 1,
  })

  // Нормализация: результат может быть массивом, { data: [] } или { result: [] }
  let posts: any[] = []
  if (Array.isArray(result)) {
    posts = result
  } else if (result && typeof result === 'object') {
    if (Array.isArray(result.data)) posts = result.data
    else if (Array.isArray(result.result)) posts = result.result
  }

  // Сохраняем порядок запрошенных ID для корректной пагинации
  if (posts.length > 0) {
    const postsMap = new Map(posts.map((p: any) => [p.txid || p.id, p]))
    posts = idsToFetch.map((id) => postsMap.get(id)).filter((p) => p !== undefined)
  }

  return { data: { contents: posts } } as any
}

/**
 * Запрос ленты обсуждаемого (getMostCommentedFeed) — без кэша.
 */
export function fetchMostCommentedFeed(params: FetchParams): Promise<GetHierarchicalStripResponse> {
  const { currentTxid, count, lang, allTags, contentTypes } = params

  return getByPRCWithAuth({
    method: rpcEndpoints.getMostCommentedFeed,
    parameters: [0, currentTxid, count, lang, allTags, contentTypes, [], [], [], '', MOST_COMMENTED_WINDOW_MINUTES],
    cachehash: generateCacheHash(),
    options: { ex: true, cache: false },
    state: 1,
  }) as Promise<GetHierarchicalStripResponse>
}

/**
 * Запрос дефолтной ленты (getHierarchicalStrip).
 */
export function fetchDefaultFeed(params: FetchParams): Promise<GetHierarchicalStripResponse> {
  const { currentTxid, count, lang, allTags, contentTypes, address } = params

  return getByPRCWithAuth({
    method: rpcEndpoints.getHierarchicalStrip,
    parameters: [0, currentTxid, count, lang, allTags, contentTypes, [], [], [], '', address],
    cachehash: generateCacheHash(),
    options: { ex: true },
    state: 1,
  }) as Promise<GetHierarchicalStripResponse>
}
