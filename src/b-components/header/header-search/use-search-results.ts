/**
 * Агрегатор четырёх RPC поисковых запросов для header-search dropdown.
 * Скрывает от шаблона детали отдельных query'ев — наружу торчат только
 * списки и сводные `isLoading`/`hasAny`.
 *
 * Размеры лимитов (5/5/5/4) подобраны под высоту дропдауна — больше
 * за раз не влезает без скролла. См. CODE_AUDIT.md §1.
 */
import { computed, type ComputedRef, type Ref } from 'vue'
import {
  useSearchUsers,
  useSearchTags,
  useSearchPosts,
  useSearchApps,
} from '@/composables/use-search-query'
import type { RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import type { SearchUserResult } from '@/types/rpc-responses/search-users'
import type { SearchPost } from '@/types/rpc-responses/search-posts'
import type { SearchTag } from '@/types/rpc-responses/search-tags'

export interface SearchResults {
  users: ComputedRef<SearchUserResult[]>
  tags: ComputedRef<SearchTag[]>
  posts: ComputedRef<SearchPost[]>
  apps: ComputedRef<RemoteAppEntry[]>
  isLoading: ComputedRef<boolean>
  hasAny: ComputedRef<boolean>
}

export function useSearchResults(query: Ref<string>): SearchResults {
  // Три раздельных RPC (users / tags / posts) + apps. Объединение в один
  // вызов `search` с type='all' зафиксировано в SEARCH_TODO §9: формат
  // ответа от ноды нужно проверить, иначе users/tags/posts оказываются
  // пустыми, как это уже однажды произошло в проде.
  const usersQuery = useSearchUsers(query, 5)
  const tagsQuery = useSearchTags(query, 5)
  const postsQuery = useSearchPosts(query, 5)
  const appsQuery = useSearchApps(query, 4)

  const users = computed<SearchUserResult[]>(() => usersQuery.data.value ?? [])
  const tags = computed<SearchTag[]>(() => tagsQuery.data.value ?? [])
  const posts = computed<SearchPost[]>(() => postsQuery.data.value ?? [])
  const apps = computed<RemoteAppEntry[]>(() => appsQuery.data.value ?? [])

  const isLoading = computed(
    () =>
      usersQuery.isFetching.value ||
      tagsQuery.isFetching.value ||
      postsQuery.isFetching.value ||
      appsQuery.isFetching.value
  )

  const hasAny = computed(
    () => users.value.length + tags.value.length + posts.value.length + apps.value.length > 0
  )

  return { users, tags, posts, apps, isLoading, hasAny }
}
