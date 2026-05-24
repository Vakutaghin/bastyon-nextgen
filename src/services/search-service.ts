/**
 * Поиск по нодe Pocketnet (users / posts / tags).
 *
 * Аналог оригинального `psdk.search.get(value, type, start, count, …)` из
 * pocketnet.gui. Сервер использует два RPC-метода:
 *   - `searchusers` — для пользователей; параметры [value, type, fixedBlock, start, count]
 *   - `search`      — для остального; те же позиционные параметры, type ∈ {posts, tags, videos, all}
 *
 * Очистка строки запроса: оригинал убирает любые символы, кроме букв (рус/лат),
 * цифр, `#`, пробела и подчёркивания. Повторяем это здесь, чтобы запросы
 * имели одинаковый кэш-ключ с прежним поведением.
 */

import { rpcCall } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import type { SearchUsersData } from '@/types/rpc-responses/search-users'
import type { SearchPostsData, SearchPost } from '@/types/rpc-responses/search-posts'
import type { SearchTagsData, SearchTag } from '@/types/rpc-responses/search-tags'

const SEARCH_VALUE_FORBIDDEN = /[^а-яА-Яa-zA-Z0-9# _]+/g

/** Нормализация поискового запроса (см. satolist.js:16234 в оригинале). */
export function sanitizeSearchQuery(value: string): string {
  return value.replace(SEARCH_VALUE_FORBIDDEN, '').trim()
}

export interface SearchPaging {
  /** Смещение в результатах (для пагинации). По умолчанию 0. */
  start?: number
  /** Сколько элементов вернуть. По умолчанию 10. */
  count?: number
  /** Фиксация на блоке — нужна для стабильности пагинации. 0 = последний. */
  fixedBlock?: number
}

export async function searchUsers(
  query: string,
  paging: SearchPaging = {}
): Promise<SearchUsersData> {
  const value = sanitizeSearchQuery(query)
  if (!value) return []

  const { start = 0, count = 10, fixedBlock = 0 } = paging

  const data = await rpcCall<SearchUsersData>({
    method: rpcEndpoints.searchUsers,
    parameters: [value, 'users', fixedBlock, start, count],
    options: { auth: false },
  })

  return Array.isArray(data) ? data : []
}

export async function searchPosts(
  query: string,
  paging: SearchPaging = {}
): Promise<SearchPost[]> {
  const value = sanitizeSearchQuery(query)
  if (!value) return []

  const { start = 0, count = 10, fixedBlock = 0 } = paging

  const data = await rpcCall<SearchPostsData>({
    method: rpcEndpoints.search,
    parameters: [value, 'posts', fixedBlock, start, count],
    options: { auth: false },
  })

  return data?.posts?.data ?? []
}

export async function searchTags(
  query: string,
  paging: SearchPaging = {}
): Promise<SearchTag[]> {
  const value = sanitizeSearchQuery(query)
  if (!value) return []

  const { start = 0, count = 10, fixedBlock = 0 } = paging

  const data = await rpcCall<SearchTagsData>({
    method: rpcEndpoints.search,
    parameters: [value, 'tags', fixedBlock, start, count],
    options: { auth: false },
  })

  const raw = data?.tags?.data ?? []
  return raw
    .map((t) => {
      try {
        return { tag: decodeURIComponent(decodeURIComponent(t.tag)), count: t.count }
      } catch {
        return t
      }
    })
    .filter((t): t is SearchTag => Boolean(t?.tag))
}
