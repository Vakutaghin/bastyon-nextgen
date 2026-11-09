// Личные списки (services/media-library/media-library-doc.ts): «Избранное»,
// «Смотреть позже», личные плейлисты и коллекции.
//
// Список — в данных аккаунта Matrix, общий для устройств; локальная копия
// (`BST_MEDIA_LIBRARY_<адрес>`) показывает его сразу после запуска и держит
// изменения, пока сервер чатов недоступен. С сервером стор связывает
// мессенджер: он входит в Matrix и пересылает сюда изменения с других
// устройств (`applyRemote`), как и для списка каналов.
//
// Закладки постов до 0.32 хранились только на устройстве (таблица favorites в
// IndexedDB). При первом подключении аккаунта они переезжают в «Избранное», и
// таблица аккаунта очищается.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { MEDIA_LIBRARY_PREFIX } from '@/blockchain/constants/storage'
import { matrixService } from '@/b-components/messenger/services/matrix-service'
import { favoritesAPI } from '@/db/apis/favorites-api'
import { logger } from '@/services/logger'
import {
  MEDIA_LIBRARY_ACCOUNT_DATA,
  PLAYLIST_PREFIX,
  createPlaylist as createPlaylistIn,
  deletePlaylist as deletePlaylistIn,
  emptyLibraryDoc,
  favoriteIds,
  hasItem,
  importFavorites,
  isFavorite as isFavoriteIn,
  listItemIds,
  mergeLibraryDoc,
  moveItem as moveItemIn,
  parseLibraryDoc,
  playlistIds,
  pruneLibraryDoc,
  renamePlaylist as renamePlaylistIn,
  sameLibraryDoc,
  setFavorite as setFavoriteIn,
  setItem,
  SYSTEM_LISTS,
  type LibraryKind,
  type MediaLibraryDoc,
} from '@/services/media-library/media-library-doc'

const log = logger.scope('[MediaLibrary]')

/** Изменения копятся и уходят на сервер одной записью. */
const PUSH_DELAY = 1500

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function readStored(owner: string): MediaLibraryDoc {
  try {
    const raw = storage()?.getItem(`${MEDIA_LIBRARY_PREFIX}${owner}`)
    return raw ? parseLibraryDoc(JSON.parse(raw)) : emptyLibraryDoc()
  } catch {
    return emptyLibraryDoc()
  }
}

function randomPlaylistId(): string {
  const bytes = new Uint8Array(8)
  globalThis.crypto.getRandomValues(bytes)
  return PLAYLIST_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const useMediaLibraryStore = defineStore('media-library', () => {
  /** Чей список: адрес вошедшего аккаунта. */
  const owner = ref<string | null>(null)
  const doc = ref<MediaLibraryDoc>(emptyLibraryDoc())

  const attached = computed(() => !!owner.value)

  /** false — копия не легла (переполнение): останется в памяти до следующего раза. */
  function persist(): boolean {
    if (!owner.value) return false
    try {
      const store = storage()
      if (!store) return false
      store.setItem(`${MEDIA_LIBRARY_PREFIX}${owner.value}`, JSON.stringify(doc.value))
      return true
    } catch {
      return false
    }
  }

  // --- Сервер чатов ---

  let dirty = false
  let pushTimer: ReturnType<typeof setTimeout> | null = null

  async function pushNow(): Promise<void> {
    pushTimer = null
    if (!dirty || !matrixService.getClient()) return
    dirty = false
    try {
      const content = pruneLibraryDoc(doc.value, Date.now())
      await matrixService.setAccountData(MEDIA_LIBRARY_ACCOUNT_DATA, { ...content })
    } catch (e) {
      log.warn('library not saved to server', e)
      dirty = true
    }
  }

  function schedulePush(): void {
    dirty = true
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => void pushNow(), PUSH_DELAY)
  }

  /** Копия с сервера (первый синк или изменение с другого устройства). */
  function applyRemote(content: unknown): void {
    if (!owner.value) return
    const remote = parseLibraryDoc(content)
    const merged = mergeLibraryDoc(doc.value, remote)
    if (!sameLibraryDoc(merged, doc.value)) {
      doc.value = merged
      persist()
    }
    if (!sameLibraryDoc(merged, remote)) schedulePush()
  }

  /** Первый синк прошёл: забрать серверную копию и отдать свою, если в ней новее. */
  function syncWithServer(): void {
    applyRemote(matrixService.getAccountData(MEDIA_LIBRARY_ACCOUNT_DATA))
    if (dirty) void pushNow()
  }

  // --- Аккаунт ---

  /** Перенос закладок с устройства; лента «Избранного» его ждёт. */
  let imported: Promise<void> = Promise.resolve()

  function attach(address: string): void {
    if (owner.value === address) return
    reset()
    owner.value = address
    doc.value = readStored(address)
    // Клиент Matrix уже работает (вошли раньше, чем открыли раздел): серверная копия есть.
    if (matrixService.getClient()) syncWithServer()
    imported = importDeviceFavorites(address)
  }

  /** Закладки, которые жили только на этом устройстве, — в «Избранное». */
  async function importDeviceFavorites(address: string): Promise<void> {
    try {
      const rows = await favoritesAPI.getList(address)
      if (!rows.length || owner.value !== address) return
      const next = importFavorites(
        doc.value,
        rows.map((r) => ({ txid: r.id, at: r.addedAt })),
        Date.now()
      )
      if (next !== doc.value) {
        doc.value = next
        // Таблицу чистим, только когда копия легла: иначе закладки пропадут.
        if (!persist()) return
        schedulePush()
      }
      await favoritesAPI.purge(address)
    } catch (e) {
      log.warn('device favorites not imported', e)
    }
  }

  function reset(): void {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = null
    dirty = false
    owner.value = null
    doc.value = emptyLibraryDoc()
    imported = Promise.resolve()
  }

  function change(next: MediaLibraryDoc | null): boolean {
    if (!owner.value || !next || next === doc.value) return false
    doc.value = next
    persist()
    schedulePush()
    return true
  }

  // --- Чтение ---

  const ids = (listId: string): string[] => listItemIds(doc.value, listId)
  const has = (listId: string, txid: string): boolean => hasItem(doc.value, listId, txid)
  const playlists = (kind: LibraryKind): string[] => playlistIds(doc.value, kind)
  const nameOf = (listId: string): string => doc.value.lists[listId]?.name ?? ''
  /** Что внутри: у встроенного — по id, у личного — из документа. */
  const kindOf = (listId: string): LibraryKind | null =>
    SYSTEM_LISTS[listId] ?? doc.value.lists[listId]?.kind ?? null

  const favorites = computed(() => favoriteIds(doc.value))
  const isFavorite = (txid: string): boolean => isFavoriteIn(doc.value, txid)

  /**
   * «Избранное» аккаунта — для ленты раздела «Избранное». Ждёт переноса
   * закладок с устройства, чтобы первая страница не вышла пустой.
   */
  async function favoritesFor(address: string): Promise<string[]> {
    if (!address) return []
    attach(address)
    await imported
    return owner.value === address ? favorites.value : []
  }

  // --- Изменения пользователем ---

  function toggle(listId: string, txid: string, on: boolean): boolean {
    return change(setItem(doc.value, listId, txid, on, Date.now()))
  }

  function setFavorite(txid: string, on: boolean): boolean {
    return change(setFavoriteIn(doc.value, txid, on, Date.now()))
  }

  function move(listId: string, txid: string, index: number): boolean {
    return change(moveItemIn(doc.value, listId, txid, index, Date.now()))
  }

  /**
   * Новый личный плейлист или коллекция, сразу с записями (в их порядке);
   * null — предел числа списков.
   */
  function createPlaylist(
    kind: LibraryKind,
    name: string,
    items: readonly string[] = []
  ): string | null {
    const id = randomPlaylistId()
    const now = Date.now()
    let next = createPlaylistIn(doc.value, id, kind, name, now)
    if (!next) return null
    for (const txid of items) next = setItem(next, id, txid, true, now)
    return change(next) ? id : null
  }

  function renamePlaylist(listId: string, name: string): boolean {
    return change(renamePlaylistIn(doc.value, listId, name, Date.now()))
  }

  function deletePlaylist(listId: string): boolean {
    return change(deletePlaylistIn(doc.value, listId, Date.now()))
  }

  return {
    owner,
    doc,
    attached,
    attach,
    reset,
    applyRemote,
    syncWithServer,
    ids,
    has,
    playlists,
    nameOf,
    kindOf,
    favorites,
    isFavorite,
    favoritesFor,
    toggle,
    setFavorite,
    move,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
  }
})
