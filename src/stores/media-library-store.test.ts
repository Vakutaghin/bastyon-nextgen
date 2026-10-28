// Личные списки: локальная копия, отправка на сервер чатов одной записью,
// слияние с копией другого устройства.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const matrix = vi.hoisted(() => ({
  client: null as object | null,
  remote: undefined as unknown,
  setAccountData: vi.fn(async (_type: string, _content: Record<string, unknown>) => undefined),
}))

vi.mock('@/b-components/messenger/services/matrix-service', () => ({
  matrixService: {
    getClient: () => matrix.client,
    getAccountData: () => matrix.remote,
    setAccountData: (type: string, content: Record<string, unknown>) =>
      matrix.setAccountData(type, content),
  },
}))

import { useMediaLibraryStore } from './media-library-store'
import { MEDIA_LIBRARY_ACCOUNT_DATA, MY_MUSIC } from '@/services/media-library/media-library-doc'

const ADDRESS = 'PDUWW57W8DoV1dMTQYsrkwg66xEuaNckbd'
const id = (n: number): string => n.toString(16).padStart(64, '0')

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  matrix.client = null
  matrix.remote = undefined
  matrix.setAccountData.mockClear()
  vi.useFakeTimers()
})

afterEach(() => vi.useRealTimers())

describe('media-library-store', () => {
  it('без входа ничего не меняет', () => {
    const store = useMediaLibraryStore()
    expect(store.toggle(MY_MUSIC, id(1), true)).toBe(false)
  })

  it('изменение сразу в локальной копии и одной записью на сервер', async () => {
    matrix.client = {}
    const store = useMediaLibraryStore()
    store.attach(ADDRESS)
    store.toggle(MY_MUSIC, id(1), true)
    vi.advanceTimersByTime(10)
    store.toggle(MY_MUSIC, id(2), true)
    expect(store.ids(MY_MUSIC)).toEqual([id(2), id(1)])
    expect(localStorage.getItem(`BST_MEDIA_LIBRARY_${ADDRESS}`)).toContain(id(1))
    await vi.advanceTimersByTimeAsync(2000)
    expect(matrix.setAccountData).toHaveBeenCalledTimes(1)
    expect(matrix.setAccountData.mock.calls[0]![0]).toBe(MEDIA_LIBRARY_ACCOUNT_DATA)
  })

  it('копия с другого устройства сливается, а наше новое уходит на сервер', async () => {
    matrix.client = {}
    const store = useMediaLibraryStore()
    store.attach(ADDRESS)
    store.toggle(MY_MUSIC, id(1), true)
    await vi.advanceTimersByTimeAsync(2000)
    matrix.setAccountData.mockClear()
    store.applyRemote({
      v: 1,
      lists: { [MY_MUSIC]: { kind: 'audio', t: 1, items: { [id(9)]: { on: true, t: 1, o: 1 } } } },
    })
    expect(store.ids(MY_MUSIC)).toEqual([id(1), id(9)])
    await vi.advanceTimersByTimeAsync(2000)
    expect(matrix.setAccountData).toHaveBeenCalledTimes(1)
  })

  it('после перезапуска список — из локальной копии своего аккаунта', () => {
    const first = useMediaLibraryStore()
    first.attach(ADDRESS)
    first.toggle(MY_MUSIC, id(3), true)
    setActivePinia(createPinia())
    const again = useMediaLibraryStore()
    again.attach(ADDRESS)
    expect(again.ids(MY_MUSIC)).toEqual([id(3)])
    again.attach('PBXC5v3VZ1VvVvVvVvVvVvVvVvVvVvVvVv')
    expect(again.ids(MY_MUSIC)).toEqual([])
  })

  it('личный плейлист: создать, переименовать, удалить', () => {
    const store = useMediaLibraryStore()
    store.attach(ADDRESS)
    const listId = store.createPlaylist('video', 'Сериал')!
    expect(listId.startsWith('p:')).toBe(true)
    expect(store.playlists('video')).toEqual([listId])
    store.renamePlaylist(listId, 'Сезон 1')
    expect(store.nameOf(listId)).toBe('Сезон 1')
    store.deletePlaylist(listId)
    expect(store.playlists('video')).toEqual([])
  })
})
