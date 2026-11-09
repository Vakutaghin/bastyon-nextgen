// «Коллекции и плейлисты»: всё своё одним списком. У каждой строки два
// свойства — что внутри (видео, аудио, публикации) и кто видит (все — список
// в блокчейне, транзакция 220; только я — личный, в данных аккаунта на сервере
// чатов). Встроенные «Избранное», «Смотреть позже» и «Скачанное» страница
// показывает отдельно, сверху. Здесь — из чего собраны строки и как их
// отбирать; сами данные — в collections-store и media-library-store.

import type { LibraryKind } from '@/services/media-library/media-library-doc'
import type { CollectionView } from '@/stores/collections-store'

export type ShelfVisibility = 'public' | 'private'

export const SHELF_KINDS: readonly LibraryKind[] = ['video', 'audio', 'posts']
export const SHELF_VISIBILITIES: readonly ShelfVisibility[] = ['public', 'private']

export type ShelfKindFilter = 'all' | LibraryKind
export type ShelfVisibilityFilter = 'all' | ShelfVisibility

export interface ShelfRow {
  /** txid коллекции или id личного списка. */
  key: string
  kind: LibraryKind
  visibility: ShelfVisibility
  /** Пусто — «Без названия» (подпись даёт страница). */
  name: string
  count: number
  to: string
  cover: string | null
  fallbackCover: string | null
  /** Публичная: она сама, с ожидающими правками. */
  collection?: CollectionView
  /** Личный список сейчас публикуется вместо себя. */
  replacing?: boolean
}

/** Свои публичные; удаляемые остаются с пометкой, пока удаление не в блоке. */
export function publicRows(list: readonly CollectionView[]): ShelfRow[] {
  return list.map((c) => ({
    key: c.txid,
    kind: c.kind,
    visibility: 'public',
    name: c.caption,
    count: c.contentIds.length,
    to: `/collection/${c.txid}`,
    cover: c.cover,
    fallbackCover: c.fallbackCover ?? null,
    collection: c,
  }))
}

export interface LibraryShelfSource {
  ids(listId: string): string[]
  playlists(kind: LibraryKind): string[]
  nameOf(listId: string): string
}

/** Личные плейлисты и коллекции (встроенные списки — не здесь). */
export function privateRows(
  library: LibraryShelfSource,
  replacing: (listId: string) => boolean = () => false
): ShelfRow[] {
  return SHELF_KINDS.flatMap((kind) =>
    library.playlists(kind).map((id) => ({
      key: id,
      kind,
      visibility: 'private' as const,
      name: library.nameOf(id),
      count: library.ids(id).length,
      to: `/library/${id}`,
      cover: null,
      fallbackCover: null,
      ...(replacing(id) ? { replacing: true } : {}),
    }))
  )
}

/** По названию; только что созданные публичные, которых ещё нет в блоке, — сверху. */
export function sortShelf(
  rows: readonly ShelfRow[],
  labelOf: (row: ShelfRow) => string
): ShelfRow[] {
  const fresh = (r: ShelfRow) => (r.collection?.pending === 'create' ? 0 : 1)
  return [...rows].sort(
    (a, b) =>
      fresh(a) - fresh(b) ||
      labelOf(a).localeCompare(labelOf(b), undefined, { sensitivity: 'base', numeric: true })
  )
}

/** Что показать: что внутри, кто видит и поиск по названию (подпись даёт страница). */
export function filterShelf(
  rows: readonly ShelfRow[],
  kind: ShelfKindFilter,
  visibility: ShelfVisibilityFilter,
  search: string,
  labelOf: (row: ShelfRow) => string
): ShelfRow[] {
  const q = search.trim().toLocaleLowerCase()
  return rows.filter(
    (r) =>
      (kind === 'all' || r.kind === kind) &&
      (visibility === 'all' || r.visibility === visibility) &&
      (!q || labelOf(r).toLocaleLowerCase().includes(q))
  )
}

/** Сколько строк каждого вида — при выбранном «кто видит». */
export function kindCounts(
  rows: readonly ShelfRow[],
  visibility: ShelfVisibilityFilter
): Record<ShelfKindFilter, number> {
  const counts: Record<ShelfKindFilter, number> = { all: 0, video: 0, audio: 0, posts: 0 }
  for (const r of rows) {
    if (visibility !== 'all' && r.visibility !== visibility) continue
    counts.all += 1
    counts[r.kind] += 1
  }
  return counts
}

/** Сколько публичных и личных — при выбранном «что внутри». */
export function visibilityCounts(
  rows: readonly ShelfRow[],
  kind: ShelfKindFilter
): Record<ShelfVisibilityFilter, number> {
  const counts: Record<ShelfVisibilityFilter, number> = { all: 0, public: 0, private: 0 }
  for (const r of rows) {
    if (kind !== 'all' && r.kind !== kind) continue
    counts.all += 1
    counts[r.visibility] += 1
  }
  return counts
}
