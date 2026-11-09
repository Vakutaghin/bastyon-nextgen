// Посты личного списка («Избранное», «Смотреть позже», личный плейлист или
// коллекция) по странице: в списке может быть до тысячи txid, а нода отдаёт
// посты пачками.
//
// «Избранное» в разделе «Видео» или «Аудио» показывает только записи этого
// типа, а какого типа запись, видно лишь по загруженному посту. Поэтому
// страница добирается пачками, пока не наберётся полной или список не кончится
// — как лента «Избранного» (N11).

import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useMediaLibraryStore } from '@/stores/media-library-store'
import { fetchCollectionItems } from '@/services/collections/collections-api'
import { fetchMediaInfo, type MediaInfo } from '@/services/media/media-info'
import { mediaTypeOf, postId } from '@/services/media/media-post'
import { FAVORITES, type LibraryKind } from '@/services/media-library/media-library-doc'
import { useBlockedAuthors } from '@/composables/use-blocked-authors'
import type { AdaptedPost } from '@/types/adapted-post'

const PAGE = 30

/**
 * `enabled` — грузить ли сейчас (окно, смонтированное заранее, ждёт, пока
 * его откроют); без него — сразу.
 */
export function useLibraryList(
  listId: Ref<string>,
  kind?: Ref<LibraryKind | undefined>,
  enabled?: Ref<boolean>
) {
  const library = useMediaLibraryStore()
  const { filterBlocked } = useBlockedAuthors()
  const isFavorites = computed(() => listId.value === FAVORITES)
  const ids = computed(() => (isFavorites.value ? library.favorites : library.ids(listId.value)))
  /** Тип записей, если список смешанный, а показать нужно один. */
  const only = computed<'video' | 'audio' | null>(() =>
    isFavorites.value && (kind?.value === 'video' || kind?.value === 'audio') ? kind.value : null
  )
  const loaded = shallowRef<Map<string, AdaptedPost | null>>(new Map())
  const info = shallowRef<Map<string, MediaInfo>>(new Map())
  /** Сколько записей показать. */
  const wanted = ref(PAGE)
  /** Сколько id с начала списка уже просмотрено. */
  const scanned = ref(0)
  const loading = ref(false)
  const error = ref(false)
  let generation = 0

  const fits = (p: AdaptedPost | null | undefined): p is AdaptedPost =>
    !!p && (!only.value || mediaTypeOf(p) === only.value)

  /** Подходящие записи из просмотренных, в порядке списка; удалённые пропускаем. */
  const matched = computed<AdaptedPost[]>(() =>
    filterBlocked(
      ids.value
        .slice(0, scanned.value)
        .map((id) => loaded.value.get(id))
        .filter(fits)
    )
  )
  const posts = computed(() => matched.value.slice(0, wanted.value))
  const hasMore = computed(
    () => matched.value.length > wanted.value || scanned.value < ids.value.length
  )

  async function load(want: string[], mine: number): Promise<void> {
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
  }

  async function fill(): Promise<void> {
    if (enabled && !enabled.value) return
    const mine = generation
    error.value = false
    try {
      while (mine === generation) {
        const missing = ids.value.slice(0, scanned.value).filter((id) => !loaded.value.has(id))
        if (missing.length) {
          loading.value = true
          await load(missing, mine)
          continue
        }
        if (matched.value.length >= wanted.value || scanned.value >= ids.value.length) break
        scanned.value = Math.min(ids.value.length, scanned.value + PAGE)
      }
    } catch {
      if (mine === generation) error.value = true
    } finally {
      if (mine === generation) loading.value = false
    }
  }

  // Один проход за раз; позвали во время прохода — ещё один после него.
  let running: Promise<void> | null = null
  let again = false
  function ensure(): Promise<void> {
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      do {
        again = false
        await fill()
      } while (again)
      running = null
    })()
    return running
  }

  /** Все подходящие посты списка, не только показанные: для «Скачать всё». */
  async function all(): Promise<AdaptedPost[]> {
    const missing = ids.value.filter((id) => !loaded.value.has(id))
    if (missing.length) {
      const items = await fetchCollectionItems(missing)
      const next = new Map(loaded.value)
      missing.forEach((id, i) => next.set(id, items[i] ?? null))
      loaded.value = next
    }
    return filterBlocked(ids.value.map((id) => loaded.value.get(id)).filter(fits))
  }

  function loadMore(): void {
    if (!hasMore.value || loading.value) return
    wanted.value += PAGE
    void ensure()
  }

  watch([listId, only], () => {
    generation += 1
    wanted.value = PAGE
    scanned.value = 0
    loaded.value = new Map()
    again = true
    void ensure()
  })
  // Добавили или убрали — догрузить новое, не трогая уже показанное.
  watch(ids, () => void ensure(), { immediate: true })
  if (enabled) watch(enabled, (on) => on && void ensure())

  return {
    ids,
    posts,
    info,
    loading,
    error,
    hasMore,
    filtered: computed(() => !!only.value),
    loadMore,
    retry: ensure,
    all,
    postId,
  }
}
