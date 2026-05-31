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

import { rpcCall, getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import type { SearchUsersData } from '@/types/rpc-responses/search-users'
import type { SearchPostsData, SearchPost } from '@/types/rpc-responses/search-posts'
import type { SearchTagsData, SearchTag } from '@/types/rpc-responses/search-tags'

const SEARCH_VALUE_FORBIDDEN = /[^а-яА-Яa-zA-Z0-9# _]+/g

/**
 * TTL для кеша текущей высоты блока. Берём 30 секунд — pocketnet блок ~60 сек,
 * значение не должно «протухать» между страницами одного запроса, но и не
 * висеть в памяти бесконечно.
 */
const BLOCK_HEIGHT_TTL_MS = 30_000

let cachedBlockHeight: number | null = null
let cachedBlockFetchedAt = 0
let inflightBlockRequest: Promise<number | null> | null = null

/**
 * Возвращает текущую высоту блока с ноды (`getnodeinfo`) для фиксации
 * пагинации поиска. В оригинале это `self.currentBlock` — клиент сам
 * выбирает блок и передаёт его в каждый запрос как `fixedBlock`, чтобы
 * за время листания результаты не «съезжали» из-за добавляющихся постов
 * (satolist.js:16265).
 *
 * Возвращает `null`, если запрос не удался — вызывающий код должен в этом
 * случае fall back на `fixedBlock = 0` (нода вернёт «как есть»).
 */
export async function getCurrentBlockHeight(): Promise<number | null> {
  const now = Date.now()
  if (cachedBlockHeight !== null && now - cachedBlockFetchedAt < BLOCK_HEIGHT_TTL_MS) {
    return cachedBlockHeight
  }
  if (inflightBlockRequest) return inflightBlockRequest

  inflightBlockRequest = (async () => {
    try {
      const response = (await getByPRC({
        method: rpcEndpoints.getNodeInfo,
        parameters: [],
        options: { auth: false },
      } as Parameters<typeof getByPRC>[0])) as {
        data?: { lastblock?: { height?: number } }
        lastblock?: { height?: number }
      } | null
      const data = response?.data ?? response
      const height = data?.lastblock?.height
      if (typeof height === 'number' && height > 0) {
        cachedBlockHeight = height
        cachedBlockFetchedAt = now
        return height
      }
    } catch (e) {
      console.warn('getCurrentBlockHeight failed:', e)
    } finally {
      inflightBlockRequest = null
    }
    return cachedBlockHeight
  })()

  return inflightBlockRequest
}

/** Для тестов: сбросить TTL-кеш блока. */
export function __resetBlockHeightCache(): void {
  cachedBlockHeight = null
  cachedBlockFetchedAt = 0
  inflightBlockRequest = null
}

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

export async function searchPosts(query: string, paging: SearchPaging = {}): Promise<SearchPost[]> {
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

/**
 * Объединённого поиска (`search` с type='all') НЕТ: проверено живым
 * запросом к `4.pocketnet.app` — нода на любой запрос отвечает
 * `{ result: 'success', data: {} }` (пустой объект). Метод просто не
 * реализован на текущей версии ноды, поэтому dropdown использует три
 * раздельных хука (searchUsers + searchPosts + searchTags). Подробности и
 * историю см. в SEARCH_TODO §9. Если в будущем нода начнёт поддерживать
 * type='all', формат по-типам известен:
 *   - users → плоский массив (как у `searchusers`)
 *   - posts → `{ data: [...] }`
 *   - tags  → `{ data: [...] }`
 */

export async function searchTags(query: string, paging: SearchPaging = {}): Promise<SearchTag[]> {
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
