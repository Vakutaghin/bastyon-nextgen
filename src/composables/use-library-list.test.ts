// Личный список по странице. «Избранное» в разделе «Видео» показывает только
// ролики: если первые пачки — сплошь посты и треки, страница добирается
// дальше, пока не наберётся или список не кончится.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'

const fetchItems = vi.hoisted(() => vi.fn())

vi.mock('@/services/collections/collections-api', () => ({
  fetchCollectionItems: (ids: string[]) => fetchItems(ids),
}))
vi.mock('@/services/media/media-info', () => ({
  fetchMediaInfo: async () => new Map(),
}))
vi.mock('@/composables/use-blocked-authors', () => ({
  useBlockedAuthors: () => ({ filterBlocked: <T>(list: T[]) => list }),
}))
vi.mock('@/db/apis/favorites-api', () => ({
  favoritesAPI: { getList: async () => [], purge: async () => undefined },
}))

import { useLibraryList } from './use-library-list'
import { useMediaLibraryStore } from '@/stores/media-library-store'
import { FAVORITES } from '@/services/media-library/media-library-doc'

const ADDRESS = 'PDUWW57W8DoV1dMTQYsrkwg66xEuaNckbd'
const tx = (n: number): string => n.toString(16).padStart(64, '0')

/** Посты 1–60 — текст, 61–65 — ролики. */
const typeOf = (id: string): string => (parseInt(id, 16) > 60 ? 'video' : 'share')

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  fetchItems.mockReset()
  fetchItems.mockImplementation(async (ids: string[]) =>
    ids.map((id) => ({ txid: id, hash: id, type: typeOf(id), videoUrl: `peertube://h/${id}` }))
  )
  vi.useFakeTimers({ toFake: ['Date'] })
})

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

describe('useLibraryList', () => {
  it('«Избранное» в разделе «Видео»: добирает пачками, пока не найдёт ролики', async () => {
    const library = useMediaLibraryStore()
    library.attach(ADDRESS)
    // Свежее сверху: ролики добавлены первыми — окажутся в конце списка.
    for (let n = 65; n >= 1; n--) {
      vi.setSystemTime(1000 + (65 - n))
      library.setFavorite(tx(n), true)
    }
    const list = useLibraryList(ref(FAVORITES), ref('video'))
    await settle()
    expect(list.filtered.value).toBe(true)
    expect(list.posts.value.map((p) => p.txid)).toEqual([tx(61), tx(62), tx(63), tx(64), tx(65)])
    expect(fetchItems).toHaveBeenCalledTimes(3)
    expect(list.hasMore.value).toBe(false)
  })

  it('обычный список — страница из первых записей, без фильтра', async () => {
    const library = useMediaLibraryStore()
    library.attach(ADDRESS)
    const id = library.createPlaylist('posts', 'Всё', [tx(1), tx(61), tx(2)])!
    const list = useLibraryList(ref(id), ref('posts'))
    await settle()
    expect(list.filtered.value).toBe(false)
    expect(list.posts.value.map((p) => p.txid)).toEqual([tx(1), tx(61), tx(2)])
    expect(fetchItems).toHaveBeenCalledTimes(1)
  })

  it('пока окно закрыто, ничего не грузит', async () => {
    const library = useMediaLibraryStore()
    library.attach(ADDRESS)
    library.setFavorite(tx(61), true)
    const enabled = ref(false)
    const list = useLibraryList(ref(FAVORITES), ref('video'), enabled)
    await settle()
    expect(fetchItems).not.toHaveBeenCalled()
    enabled.value = true
    await settle()
    expect(list.posts.value).toHaveLength(1)
  })
})
