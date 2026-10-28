// Личные списки: разбор, слияние копий двух устройств, порядок и правки.

import { describe, expect, it } from 'vitest'
import {
  MY_MUSIC,
  SAVED_VIDEOS,
  TOMBSTONE_TTL_MS,
  createPlaylist,
  deletePlaylist,
  emptyLibraryDoc,
  hasItem,
  listItemIds,
  mergeLibraryDoc,
  moveItem,
  parseLibraryDoc,
  playlistIds,
  pruneLibraryDoc,
  renamePlaylist,
  sameLibraryDoc,
  setItem,
} from './media-library-doc'

const id = (n: number): string => n.toString(16).padStart(64, '0')
const P = 'p:abcd1234'

describe('media-library-doc', () => {
  it('разбор отбрасывает чужое: неизвестные списки, битые txid, чужой тип у встроенного', () => {
    const doc = parseLibraryDoc({
      lists: {
        [MY_MUSIC]: {
          kind: 'video',
          t: 1,
          items: { [id(1)]: { on: true, t: 5 }, bad: { on: true, t: 1 } },
        },
        other: { kind: 'audio', t: 1, items: {} },
        [P]: { kind: 'video', name: 'Мой', t: 2, items: {} },
        'p:x': { kind: 'video', t: 2, items: {} },
      },
    })
    expect(Object.keys(doc.lists).sort()).toEqual([MY_MUSIC, P])
    expect(doc.lists[MY_MUSIC]!.kind).toBe('audio')
    expect(doc.lists[MY_MUSIC]!.items[id(1)]).toEqual({ on: true, t: 5, o: 5 })
  })

  it('«Моя музыка»: свежие сверху, повторное добавление ничего не меняет', () => {
    let doc = setItem(emptyLibraryDoc(), MY_MUSIC, id(1), true, 100)
    doc = setItem(doc, MY_MUSIC, id(2), true, 200)
    expect(listItemIds(doc, MY_MUSIC)).toEqual([id(2), id(1)])
    expect(setItem(doc, MY_MUSIC, id(2), true, 300)).toBe(doc)
    doc = setItem(doc, MY_MUSIC, id(2), false, 400)
    expect(hasItem(doc, MY_MUSIC, id(2))).toBe(false)
    expect(listItemIds(doc, MY_MUSIC)).toEqual([id(1)])
  })

  it('личный плейлист: новое в конец, перестановка, переименование, удаление', () => {
    let doc = createPlaylist(emptyLibraryDoc(), P, 'video', '  Сериал  ', 10)!
    expect(doc.lists[P]!.name).toBe('Сериал')
    doc = setItem(doc, P, id(1), true, 20)
    doc = setItem(doc, P, id(2), true, 30)
    doc = setItem(doc, P, id(3), true, 40)
    expect(listItemIds(doc, P)).toEqual([id(1), id(2), id(3)])
    doc = moveItem(doc, P, id(3), 0, 50)
    expect(listItemIds(doc, P)).toEqual([id(3), id(1), id(2)])
    doc = moveItem(doc, P, id(3), 1, 60)
    expect(listItemIds(doc, P)).toEqual([id(1), id(3), id(2)])
    doc = renamePlaylist(doc, P, 'Сезон 1', 70)
    expect(playlistIds(doc, 'video')).toEqual([P])
    doc = deletePlaylist(doc, P, 80)
    expect(playlistIds(doc, 'video')).toEqual([])
    expect(listItemIds(doc, P)).toEqual([])
  })

  it('слияние: у каждого элемента побеждает позднее изменение', () => {
    const base = setItem(emptyLibraryDoc(), MY_MUSIC, id(1), true, 100)
    const phone = setItem(base, MY_MUSIC, id(1), false, 200)
    const laptop = setItem(base, MY_MUSIC, id(2), true, 150)
    const merged = mergeLibraryDoc(laptop, phone)
    expect(listItemIds(merged, MY_MUSIC)).toEqual([id(2)])
    expect(sameLibraryDoc(merged, mergeLibraryDoc(phone, laptop))).toBe(true)
  })

  it('слияние: удаление плейлиста позже правки побеждает', () => {
    const base = setItem(
      createPlaylist(emptyLibraryDoc(), P, 'audio', 'А', 10)!,
      P,
      id(1),
      true,
      20
    )
    const removed = deletePlaylist(base, P, 100)
    const renamed = renamePlaylist(base, P, 'Б', 50)
    expect(playlistIds(mergeLibraryDoc(renamed, removed), 'audio')).toEqual([])
  })

  it('давние отметки об удалении забываются', () => {
    let doc = setItem(emptyLibraryDoc(), SAVED_VIDEOS, id(1), true, 1)
    doc = setItem(doc, SAVED_VIDEOS, id(1), false, 2)
    doc = setItem(doc, SAVED_VIDEOS, id(2), true, 3)
    const pruned = pruneLibraryDoc(doc, 2 + TOMBSTONE_TTL_MS + 1)
    expect(Object.keys(pruned.lists[SAVED_VIDEOS]!.items)).toEqual([id(2)])
  })
})
