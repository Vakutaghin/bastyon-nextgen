// Посты личного списка («Сохранённые», «Смотреть позже», «Моя музыка»,
// личный плейлист) по странице: в списке может быть до тысячи txid, а нода
// отдаёт посты пачками.

import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useMediaLibraryStore } from '@/stores/media-library-store'
import { fetchCollectionItems } from '@/services/collections/collections-api'
import { fetchMediaInfo, type MediaInfo } from '@/services/media/media-info'
import { mediaTypeOf, postId } from '@/services/media/media-post'
import { useBlockedAuthors } from '@/composables/use-blocked-authors'
import type { AdaptedPost } from '@/types/adapted-post'

const PAGE = 30

export function useLibraryList(listId: Ref<string>) {
  const library = useMediaLibraryStore()
  const { filterBlocked } = useBlockedAuthors()
  const ids = computed(() => library.ids(listId.value))
  const loaded = shallowRef<Map<string, AdaptedPost | null>>(new Map())
  const info = shallowRef<Map<string, MediaInfo>>(new Map())
  const shown = ref(PAGE)
  const loading = ref(false)
  const error = ref(false)
  let generation = 0

  /** В порядке списка; удалённые посты пропускаем. */
  const posts = computed<AdaptedPost[]>(() =>
    filterBlocked(
      ids.value
        .slice(0, shown.value)
        .map((id) => loaded.value.get(id))
        .filter((p): p is AdaptedPost => !!p)
    )
  )
  const hasMore = computed(() => shown.value < ids.value.length)

  async function ensure(): Promise<void> {
    const mine = generation
    const want = ids.value.slice(0, shown.value).filter((id) => !loaded.value.has(id))
    if (!want.length) return
    loading.value = true
    error.value = false
    try {
      const items = await fetchCollectionItems(want)
      if (mine !== generation) return
      const next = new Map(loaded.value)
      want.forEach((id, i) => next.set(id, items[i] ?? null))
      loaded.value = next
      const urls = items
        .filter((p): p is AdaptedPost => !!p && !!mediaTypeOf(p))
        .map((p) => p.videoUrl!)
      const fresh = await fetchMediaInfo(urls)
      if (mine === generation && fresh.size) info.value = new Map([...info.value, ...fresh])
    } catch {
      if (mine === generation) error.value = true
    } finally {
      if (mine === generation) loading.value = false
    }
  }

  function loadMore(): void {
    if (!hasMore.value || loading.value) return
    shown.value += PAGE
    void ensure()
  }

  watch(listId, () => {
    generation += 1
    shown.value = PAGE
    loaded.value = new Map()
    void ensure()
  })
  // Добавили или убрали — догрузить новое, не трогая уже показанное.
  watch(ids, () => void ensure(), { immediate: true })

  return { ids, posts, info, loading, error, hasMore, loadMore, retry: ensure, postId }
}
