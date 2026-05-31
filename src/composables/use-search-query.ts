/**
 * Composables для поиска (users / posts / tags / apps) через TanStack Vue Query.
 *
 * Запрос включается только когда длина запроса >= MIN_QUERY_LENGTH —
 * иначе мы дёргали бы API на каждую первую букву.
 */

import { computed, ref, watch, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import {
  searchUsers,
  searchPosts,
  searchTags,
  sanitizeSearchQuery,
  getCurrentBlockHeight,
  type SearchPaging,
} from '@/services/search-service'
import type { SearchUsersData } from '@/types/rpc-responses/search-users'
import type { SearchPost } from '@/types/rpc-responses/search-posts'
import type { SearchTag } from '@/types/rpc-responses/search-tags'
import { RemoteAppsLoader, type RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import { getByPRC, rpcCall } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { registerNameAddress } from '@/services/user-resolver'
import type { GetHierarchicalStripData } from '@/types/rpc-responses/get-hierarchical-strip'

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

  const result = useQuery<SearchUsersData>({
    queryKey: ['search', 'users', q, count] as const,
    queryFn: () => searchUsers(q.value, { count }),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    placeholderData: (prev) => prev,
  })

  // Регистрируем найденных пользователей в name→address кеше — чтобы
  // следующий ввод того же ника сразу резолвился без RPC.
  watch(
    () => result.data.value,
    (users) => {
      if (Array.isArray(users) && users.length) registerNameAddress(users)
    }
  )

  return result
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

/**
 * Поиск среди mini-apps через RPC `getapps` с параметром `search`.
 *
 * В оригинале первой секцией dropdown идут установленные приложения
 * (`apps.get.forsearch()` — menu/index.js:733). В новом приложении нет
 * локального реестра установленных, поэтому берём из remote registry
 * (нода фильтрует по подстроке в name/description/address).
 *
 * Создаём loader один раз модульно — RPC stateless, общий fetcher безопасен.
 */
let _appsLoader: RemoteAppsLoader | null = null
function getAppsLoader(): RemoteAppsLoader {
  if (!_appsLoader) {
    _appsLoader = new RemoteAppsLoader(async (method, parameters) =>
      getByPRC({
        method,
        parameters,
        options: { auth: false },
      } as Parameters<typeof getByPRC>[0])
    )
  }
  return _appsLoader
}

export function useSearchApps(query: Ref<string>, count = 4) {
  const q = normalizedQuery(query)
  const enabled = isQueryEnabled(query)

  return useQuery<RemoteAppEntry[]>({
    queryKey: ['search', 'apps', q, count] as const,
    queryFn: async () => {
      const page = await getAppsLoader().load({
        search: q.value,
        pageStart: 0,
        pageSize: count,
      })
      return page.apps
    },
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
 * Парсит строку запроса как «только теги». В оригинале (main/index.js:1242)
 * `?sst=tag1 tag2` фильтрует ленту по тегам через `tagsfilter`, а не идёт
 * через RPC `search` (fulltext). Здесь повторяем то же поведение: если
 * каждый токен начинается с `#`, превращаем выдачу в ленту с фильтром.
 *
 * Возвращает массив тегов без `#`, либо `null` если запрос не tag-only.
 */
export function parseTagOnlyQuery(value: string): string[] | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null
  const tags: string[] = []
  for (const token of tokens) {
    if (!token.startsWith('#')) return null
    const tag = token.replace(/^#+/, '').trim()
    if (!tag) return null
    tags.push(tag.toLowerCase())
  }
  return tags
}

/**
 * Лента, отфильтрованная по списку тегов (`gethierarchicalstrip` с
 * `tagsfilter`). Эквивалент оригинального тег-фильтра ленты: возвращает
 * посты с этими тегами, а не fulltext-поиск.
 *
 * Используется на /search?q=#tag → search-page переключается в feed-mode.
 */
export function useFeedByTags(tags: Ref<string[]>, lang: Ref<string>, count: Ref<number>) {
  const enabled = computed(() => tags.value.length > 0)

  return useQuery<GetHierarchicalStripData>({
    queryKey: computed(
      () => ['search', 'feed-by-tags', tags.value, lang.value, count.value] as const
    ),
    queryFn: () =>
      rpcCall<GetHierarchicalStripData>({
        method: rpcEndpoints.getHierarchicalStrip,
        parameters: [0, '', count.value, lang.value, tags.value, [], [], [], [], '', ''],
        options: { auth: false, ex: true },
      }),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    placeholderData: (prev) => prev,
  })
}

/**
 * Держит `fixedBlock` для пагинации поисковой выдачи. Логика:
 *
 *   - При каждой смене (query, type) сбрасываем block в `null`.
 *   - Перед первой страницей лениво запрашиваем `getnodeinfo` и фиксируем
 *     значение — все следующие страницы запроса используют тот же block,
 *     чтобы выдача не сдвигалась из-за роста цепочки между страницами.
 *
 * `fixedBlock = 0` (значение по умолчанию в RPC) означает «на ноде сейчас»
 * и допустим для headerdropdown, где пагинации нет. Использовать
 * `useSearchPagination` нужно там, где есть несколько страниц подряд
 * (как `/search` со «Показать ещё»).
 */
export function useSearchPagination(query: Ref<string>, type: Ref<SearchTabType>) {
  const q = normalizedQuery(query)
  const fixedBlock = ref(0)
  const isResolving = ref(false)

  async function resolveBlock(): Promise<void> {
    if (fixedBlock.value > 0 || isResolving.value) return
    isResolving.value = true
    try {
      const height = await getCurrentBlockHeight()
      if (typeof height === 'number' && height > 0) {
        fixedBlock.value = height
      }
    } finally {
      isResolving.value = false
    }
  }

  watch([q, type], () => {
    fixedBlock.value = 0
  })

  return { fixedBlock, resolveBlock }
}

/**
 * Универсальный composable для страницы /search — выбирает нужный тип
 * результатов по параметру `type` и параметризуется пагинацией.
 */
export function useSearchByType(
  query: Ref<string>,
  type: Ref<SearchTabType>,
  paging: Ref<SearchPaging>
) {
  const q = normalizedQuery(query)
  const enabled = isQueryEnabled(query)

  const result = useQuery<SearchUsersData | SearchPost[] | SearchTag[]>({
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

  // Регистрируем имена пользователей (как для type='users', так и для
  // постов с прикреплённым userprofile). Это идемпотентно — внутри
  // user-resolver есть дедуп по name.
  watch(
    () => result.data.value,
    (data) => {
      if (!Array.isArray(data) || data.length === 0) return
      if (type.value === 'users') {
        registerNameAddress(data as SearchUsersData)
      } else if (type.value === 'posts') {
        const profiles = (data as SearchPost[])
          .map((p) => p.userprofile as { address?: string; name?: string } | undefined)
          .filter((p): p is { address?: string; name?: string } => Boolean(p))
        if (profiles.length) registerNameAddress(profiles)
      }
    }
  )

  return result
}
