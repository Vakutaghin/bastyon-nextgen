// Строки страницы «Коллекции и плейлисты»: один список, у каждой строки — что
// внутри и кто видит; встроенных списков здесь нет. Порядок по названию,
// фильтры по двум свойствам, поиск и счётчики.

import { describe, expect, it } from 'vitest'

import type { CollectionView } from '@/stores/collections-store'
import type { LibraryKind } from '@/services/media-library/media-library-doc'
import {
  filterShelf,
  kindCounts,
  privateRows,
  publicRows,
  sortShelf,
  visibilityCounts,
  type ShelfRow,
} from './collection-shelf'

const view = (over: Partial<CollectionView>): CollectionView =>
  ({
    txid: 'a'.repeat(64),
    hash: 'h',
    address: 'PMe',
    contentTypes: null,
    caption: 'Подборка',
    description: '',
    image: '',
    lang: 'ru',
    contentIds: ['x'],
    settings: {},
    edited: false,
    kind: 'posts',
    cover: null,
    ...over,
  }) as CollectionView

const library = {
  lists: {
    'p:vid1': ['4'],
    'p:aud1': ['5', '6', '7'],
    'p:pst1': [],
  } as Record<string, string[]>,
  names: { 'p:vid1': 'Поездки', 'p:aud1': 'В дорогу', 'p:pst1': 'Рецепты' } as Record<
    string,
    string
  >,
  ids(id: string) {
    return this.lists[id] ?? []
  },
  playlists(kind: LibraryKind) {
    return { video: ['p:vid1'], audio: ['p:aud1'], posts: ['p:pst1'] }[kind]
  },
  nameOf(id: string) {
    return this.names[id] ?? ''
  },
}

const label = (r: ShelfRow) => r.name

describe('collection-shelf', () => {
  it('публичное: «видят все», ссылка на страницу коллекции; удаляемое — с пометкой, не пропадает', () => {
    const rows = publicRows([
      view({ txid: 't1', kind: 'video', caption: 'Сезон 1', contentIds: ['a', 'b'] }),
      view({ txid: 't2', kind: 'posts', pending: 'delete' }),
    ])
    expect(rows.map((r) => [r.key, r.kind, r.visibility, r.count, r.to])).toEqual([
      ['t1', 'video', 'public', 2, '/collection/t1'],
      ['t2', 'posts', 'public', 1, '/collection/t2'],
    ])
    expect(rows[1]!.collection?.pending).toBe('delete')
  })

  it('личное: плейлисты и коллекции всех видов, «только я»; публикуемое вместо себя — с пометкой', () => {
    const rows = privateRows(library, (id) => id === 'p:aud1')
    expect(rows.map((r) => [r.key, r.kind, r.visibility, r.count, !!r.replacing])).toEqual([
      ['p:vid1', 'video', 'private', 1, false],
      ['p:aud1', 'audio', 'private', 3, true],
      ['p:pst1', 'posts', 'private', 0, false],
    ])
    expect(rows.every((r) => r.to === `/library/${r.key}`)).toBe(true)
    expect(rows[0]!.name).toBe('Поездки')
  })

  it('порядок — по названию, без учёта регистра и с числами по смыслу; новая публичная — сверху', () => {
    const rows = sortShelf(
      [
        ...publicRows([
          view({ txid: 't1', caption: 'сезон 10' }),
          view({ txid: 't2', caption: 'Сезон 2' }),
          view({ txid: 't3', caption: 'Я последняя', pending: 'create' }),
        ]),
        ...privateRows(library),
      ],
      label
    )
    expect(rows.map((r) => r.key)).toEqual(['t3', 'p:aud1', 'p:vid1', 'p:pst1', 't2', 't1'])
  })

  it('фильтры по двум свойствам и поиск; счётчики одного свойства — при выбранном другом', () => {
    const rows: ShelfRow[] = [
      ...publicRows([
        view({ txid: 't1', kind: 'video', caption: 'Сезон 1' }),
        view({ txid: 't2', kind: 'audio', caption: 'Концерт' }),
      ]),
      ...privateRows(library),
    ]
    expect(filterShelf(rows, 'audio', 'all', '', label).map((r) => r.key)).toEqual(['t2', 'p:aud1'])
    expect(filterShelf(rows, 'audio', 'private', '', label).map((r) => r.key)).toEqual(['p:aud1'])
    expect(filterShelf(rows, 'all', 'all', 'СЕЗОН', label).map((r) => r.key)).toEqual(['t1'])
    expect(kindCounts(rows, 'all')).toEqual({ all: 5, video: 2, audio: 2, posts: 1 })
    expect(kindCounts(rows, 'public')).toEqual({ all: 2, video: 1, audio: 1, posts: 0 })
    expect(visibilityCounts(rows, 'video')).toEqual({ all: 2, public: 1, private: 1 })
  })
})
