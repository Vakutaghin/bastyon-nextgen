/**
 * Composables для поиска (users / posts / tags) через TanStack Vue Query.
 *
 * Запрос включается только когда длина запроса >= MIN_QUERY_LENGTH —
 * иначе мы дёргали бы API на каждую первую букву.
 */

import { computed, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import {
  searchUsers,
  searchPosts,
  searchTags,
  sanitizeSearchQuery,
  type SearchPaging,
} from '@/services/search-service'
import type { SearchUsersData } from '@/types/rpc-responses/search-users'
import type { SearchPost } from '@/types/rpc-responses/search-posts'
import type { SearchTag } from '@/types/rpc-responses/search-tags'

export const MIN_QUERY_LENGTH = 2

const SEARCH_STALE_TIME = 5 * 60 * 1000
const SEARCH_GC_TIME = 10 * 60 * 1000

function normalizedQuery(query: Ref<string>) {
  return computed(() => sanitizeSearchQuery(query.value))
}

function isQueryEnabled(query: Ref<string>) {
  const q = normalizedQuery(query)
  return computed(() => q.value.length >= MIN_QUERY_LENGTH)
}

export function useSearchUsers(query: Ref<string>, count = 7) {
  const q = normalizedQuery(query)
  const enabled = isQueryEnabled(query)

  return useQuery<SearchUsersData>({
    queryKey: ['search', 'users', q, count] as const,
    queryFn: () => searchUsers(q.value, { count }),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    placeholderData: (prev) => prev,
  })
}

export function useSearchPosts(query: Ref<string>, count = 5) {
  const q = normalizedQuery(query)
  const enabled = isQueryEnabled(query)

  return useQuery<SearchPost[]>({
    queryKey: ['search', 'posts', q, count] as const,
    queryFn: () => searchPosts(q.value, { count }),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    placeholderData: (prev) => prev,
  })
}

export function useSearchTags(query: Ref<string>, count = 5) {
  const q = normalizedQuery(query)
  const enabled = isQueryEnabled(query)

  return useQuery<SearchTag[]>({
    queryKey: ['search', 'tags', q, count] as const,
    queryFn: () => searchTags(q.value, { count }),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    placeholderData: (prev) => prev,
  })
}

export type SearchTabType = 'users' | 'posts' | 'tags'

/**
 * Универсальный composable для страницы /search — выбирает нужный тип
 * результатов по параметру `type` и параметризуется пагинацией.
 */
export function useSearchByType(
  query: Ref<string>,
  type: Ref<SearchTabType>,
  paging: Ref<SearchPaging>,
) {
  const q = normalizedQuery(query)
  const enabled = isQueryEnabled(query)

  return useQuery<SearchUsersData | SearchPost[] | SearchTag[]>({
    queryKey: computed(() => ['search', type.value, q.value, paging.value] as const),
    queryFn: () => {
      switch (type.value) {
        case 'users':
          return searchUsers(q.value, paging.value)
        case 'posts':
          return searchPosts(q.value, paging.value)
        case 'tags':
          return searchTags(q.value, paging.value)
      }
    },
    enabled,
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    placeholderData: (prev) => prev,
  })
}
