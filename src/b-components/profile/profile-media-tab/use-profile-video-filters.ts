// Поиск, порядок и тема во вкладке «Видео» профиля. Всё — в адресе (`?q=`,
// `?sort=`, `?tag=`), как поиск по постам: с ним возвращаются со страницы
// ролика к той же выдаче. Смена — replace: «Назад» уводит со страницы, а не
// перебирает кнопки.
//
// Темы для выбора — самые частые метки у роликов, которые уже видны без
// фильтра: списка меток автора нода не отдаёт. Подгрузили ещё — список
// пополняется. Выбранная тема остаётся в списке, даже если её там не было.

import { computed, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AuthorOrder } from '@/composables/use-media-feed'
import type { AdaptedPost } from '@/types/adapted-post'

export const AUTHOR_ORDERS: readonly AuthorOrder[] = ['new', 'popular', 'discussed', 'old']

/** Сколько тем в списке. */
export const TOP_TAGS = 12

export function useProfileVideoFilters() {
  const route = useRoute()
  const router = useRouter()

  const param = (name: string): string => {
    const value = route.query[name]
    return typeof value === 'string' ? value.trim() : ''
  }

  const query = computed(() => param('q'))
  const order = computed<AuthorOrder>(() => {
    const value = param('sort')
    return (AUTHOR_ORDERS as readonly string[]).includes(value) ? (value as AuthorOrder) : 'new'
  })
  const tag = computed(() => param('tag').replace(/^#/, '').toLowerCase())
  const tags = computed<string[]>(() => (tag.value ? [tag.value] : []))

  function update(patch: Record<string, string>): void {
    const next = { ...route.query }
    for (const [key, value] of Object.entries(patch)) {
      if (value) next[key] = value
      else delete next[key]
    }
    void router.replace({ query: next })
  }

  const setQuery = (value: string): void => update({ q: value.trim() })
  const setOrder = (value: AuthorOrder): void => update({ sort: value === 'new' ? '' : value })
  const setTag = (value: string): void => update({ tag: value })

  return { query, order, tag, tags, setQuery, setOrder, setTag }
}

/**
 * Самые частые темы у роликов `posts`. Пока `filtered` (поиск или тема),
 * ролики не считаются: в выдаче по теме остались бы только соседние с ней.
 */
export function useTopTags(
  posts: Readonly<Ref<AdaptedPost[]>>,
  filtered: () => boolean,
  selected: () => string
) {
  const counts = ref(new Map<string, number>())
  const counted = new Set<string>()

  watch(
    posts,
    (list) => {
      if (filtered()) return
      const next = new Map(counts.value)
      let changed = false
      for (const post of list) {
        if (!post.txid || counted.has(post.txid)) continue
        counted.add(post.txid)
        const own = new Set((post.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))
        for (const t of own) next.set(t, (next.get(t) ?? 0) + 1)
        changed ||= own.size > 0
      }
      if (changed) counts.value = next
    },
    { immediate: true }
  )

  return computed<string[]>(() => {
    const list = [...counts.value]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_TAGS)
      .map(([t]) => t)
    const current = selected()
    if (current && !list.includes(current)) list.unshift(current)
    return list
  })
}
