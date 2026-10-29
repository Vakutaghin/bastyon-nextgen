// Строки страницы «Коллекции и плейлисты»: публичное по видам, личное —
// встроенные списки всегда, потом личные плейлисты; фильтр и поиск.

import { describe, expect, it } from 'vitest'

import type { CollectionView } from '@/stores/collections-store'
import {
  filterShelf,
  privateRows,
  publicRows,
  shelfCounts,
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
    'saved-video': ['1', '2'],
    'watch-later': [],
    music: ['3'],
    'p:vid1': ['4'],
    'p:aud1': ['5', '6', '7'],
  } as Record<string, string[]>,
  names: { 'p:vid1': 'Поездки', 'p:aud1': 'В дорогу' } as Record<string, string>,
  ids(id: string) {
    return this.lists[id] ?? []
  },
  playlists(kind: 'video' | 'audio') {
    return kind === 'video' ? ['p:vid1'] : ['p:aud1']
  },
  nameOf(id: string) {
    return this.names[id] ?? ''
  },
}

describe('collection-shelf', () => {
  it('публичное: вид — группа, ссылка на страницу коллекции; удаляемое — с пометкой, не пропадает', () => {
    const rows = publicRows([
      view({ txid: 't1', kind: 'video', caption: 'Сезон 1', contentIds: ['a', 'b'] }),
      view({ txid: 't2', kind: 'posts', pending: 'delete' }),
    ])
    expect(rows.map((r) => [r.key, r.group, r.count, r.to])).toEqual([
      ['t1', 'video', 2, '/collection/t1'],
      ['t2', 'posts', 1, '/collection/t2'],
    ])
    expect(rows[1]!.collection?.pending).toBe('delete')
  })

  it('личное: встроенные списки всегда (и пустые), потом личные плейлисты видео и аудио', () => {
    const rows = privateRows(library)
    expect(rows.map((r) => [r.key, r.kind, r.count, !!r.system])).toEqual([
      ['saved-video', 'video', 2, true],
      ['watch-later', 'video', 0, true],
      ['music', 'audio', 1, true],
      ['p:vid1', 'video', 1, false],
      ['p:aud1', 'audio', 3, false],
    ])
    expect(rows.every((r) => r.group === 'private' && r.to === `/library/${r.key}`)).toBe(true)
    expect(rows[3]!.name).toBe('Поездки')
  })

  it('фильтр по группе и поиск по названию без учёта регистра; встроенные ищутся по подписи', () => {
    const rows: ShelfRow[] = [
      ...publicRows([
        view({ txid: 't1', kind: 'video', caption: 'Сезон 1' }),
        view({ txid: 't2', kind: 'audio', caption: 'Альбом' }),
      ]),
      ...privateRows(library),
    ]
    const label = (r: ShelfRow) => (r.system ? `label:${r.key}` : r.name)
    expect(filterShelf(rows, 'audio', '', label).map((r) => r.key)).toEqual(['t2'])
    expect(filterShelf(rows, 'all', 'сезон', label).map((r) => r.key)).toEqual(['t1'])
    expect(filterShelf(rows, 'private', 'MUSIC', label).map((r) => r.key)).toEqual(['music'])
    expect(shelfCounts(rows)).toEqual({ all: 7, posts: 0, video: 1, audio: 1, private: 5 })
  })
})
