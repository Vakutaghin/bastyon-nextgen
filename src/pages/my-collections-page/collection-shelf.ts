// «Коллекции и плейлисты»: всё своё одним списком. Публичное — коллекции
// публикаций, видео- и аудиоплейлисты (транзакции 220 в блокчейне); личное —
// «Сохранённые», «Смотреть позже», «Моя музыка» и личные плейлисты (данные
// аккаунта на сервере чатов). Здесь — из чего собраны строки и как их
// отбирать; сами данные — в collections-store и media-library-store.

import type { CollectionKind } from '@/services/collections/collection-model'
import {
  MY_MUSIC,
  SAVED_VIDEOS,
  WATCH_LATER,
  type LibraryKind,
} from '@/services/media-library/media-library-doc'
import type { CollectionView } from '@/stores/collections-store'

/** Группа на странице: три публичных вида и личные списки. */
export type ShelfGroup = CollectionKind | 'private'

export const SHELF_GROUPS: readonly ShelfGroup[] = ['posts', 'video', 'audio', 'private']

export type ShelfFilter = 'all' | ShelfGroup

export interface ShelfRow {
  /** txid коллекции или id личного списка. */
  key: string
  group: ShelfGroup
  kind: CollectionKind
  /** Пусто — «Без названия» (подпись даёт страница). */
  name: string
  count: number
  to: string
  cover: string | null
  fallbackCover: string | null
  /** Публичная: она сама, с ожидающими правками. */
  collection?: CollectionView
  /** Встроенный личный список: не переименовать и не удалить. */
  system?: boolean
}

/** Встроенные личные списки — всегда на месте, даже пустые. */
export const SYSTEM_SHELF: readonly { id: string; kind: LibraryKind }[] = [
  { id: SAVED_VIDEOS, kind: 'video' },
  { id: WATCH_LATER, kind: 'video' },
  { id: MY_MUSIC, kind: 'audio' },
]

/** Свои публичные; удаляемые остаются с пометкой, пока удаление не в блоке. */
export function publicRows(list: readonly CollectionView[]): ShelfRow[] {
  return list.map((c) => ({
    key: c.txid,
    group: c.kind,
    kind: c.kind,
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

/** Личные списки: сначала встроенные, потом личные плейлисты видео и аудио. */
export function privateRows(library: LibraryShelfSource): ShelfRow[] {
  const row = (id: string, kind: LibraryKind, system: boolean): ShelfRow => ({
    key: id,
    group: 'private',
    kind,
    name: system ? '' : library.nameOf(id),
    count: library.ids(id).length,
    to: `/library/${id}`,
    cover: null,
    fallbackCover: null,
    ...(system ? { system: true } : {}),
  })
  return [
    ...SYSTEM_SHELF.map((s) => row(s.id, s.kind, true)),
    ...library.playlists('video').map((id) => row(id, 'video', false)),
    ...library.playlists('audio').map((id) => row(id, 'audio', false)),
  ]
}

/**
 * Что показать: группа фильтра и поиск по названию. У встроенных списков
 * название переводное — его передаёт страница (`labelOf`).
 */
export function filterShelf(
  rows: readonly ShelfRow[],
  filter: ShelfFilter,
  search: string,
  labelOf: (row: ShelfRow) => string
): ShelfRow[] {
  const q = search.trim().toLocaleLowerCase()
  return rows.filter(
    (r) =>
      (filter === 'all' || r.group === filter) && (!q || labelOf(r).toLocaleLowerCase().includes(q))
  )
}

/** Сколько в каждой группе — для подписей фильтра. */
export function shelfCounts(rows: readonly ShelfRow[]): Record<ShelfFilter, number> {
  const counts: Record<ShelfFilter, number> = {
    all: rows.length,
    posts: 0,
    video: 0,
    audio: 0,
    private: 0,
  }
  for (const r of rows) counts[r.group] += 1
  return counts
}
