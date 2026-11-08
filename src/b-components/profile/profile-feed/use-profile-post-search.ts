/**
 * Поиск по постам профиля — как у старого клиента: RPC `search` с адресом
 * автора. Нода ищет по словам в заголовке и тексте, выдача — по
 * совпадению, не по дате. Страницы держатся на одном блоке (`fixedBlock`),
 * чтобы новые посты не сдвигали выдачу, пока её листают.
 */

import { computed, ref, watch } from 'vue'
import { adaptPostData, type AdaptedPost } from '@/composables/use-feed'
import { getCurrentBlockHeight, sanitizeSearchQuery, searchPosts } from '@/services/search-service'

export const PROFILE_SEARCH_PAGE = 10

export function useProfilePostSearch(address: () => string, query: () => string) {
  const words = computed<string>(() => sanitizeSearchQuery(query()))
  const active = computed<boolean>(() => words.value !== '')
  const posts = ref<AdaptedPost[]>([])
  const loading = ref(false)
  const error = ref(false)
  const hasMore = ref(false)

  let seq = 0
  let start = 0
  let fixedBlock = 0

  async function loadPage(mine: number): Promise<void> {
    const author = address()
    const value = words.value
    loading.value = true
    error.value = false
    try {
      if (!fixedBlock) fixedBlock = (await getCurrentBlockHeight()) ?? 0
      const found = await searchPosts(
        value,
        { start, count: PROFILE_SEARCH_PAGE, fixedBlock },
        author
      )
      if (mine !== seq) return
      start += found.length
      const known = new Set(posts.value.map((p) => p.txid))
      const fresh = found
        .filter((p) => p.address === author && !known.has(p.txid))
        .map((p, i) => adaptPostData(p as never, posts.value.length + i, {}))
      posts.value = [...posts.value, ...fresh]
      hasMore.value = found.length >= PROFILE_SEARCH_PAGE
    } catch (e) {
      console.warn('[profile] search failed', e)
      if (mine === seq) error.value = true
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  watch(
    () => [address(), words.value] as const,
    ([author, value]) => {
      const mine = ++seq
      posts.value = []
      start = 0
      fixedBlock = 0
      hasMore.value = false
      error.value = false
      loading.value = false
      if (author && value) void loadPage(mine)
    },
    { immediate: true }
  )

  function loadMore(): void {
    if (!active.value || loading.value || !hasMore.value) return
    void loadPage(seq)
  }

  /** После ошибки — та же страница ещё раз. */
  function retry(): void {
    if (!active.value || loading.value) return
    void loadPage(seq)
  }

  return { active, posts, loading, error, hasMore, loadMore, retry }
}
