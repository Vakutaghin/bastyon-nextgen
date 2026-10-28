// Личные списки видео и аудио (services/media-library/media-library-doc.ts):
// «Сохранённые видео», «Смотреть позже», «Моя музыка», личные плейлисты.
//
// Список — в данных аккаунта Matrix, общий для устройств; локальная копия
// (`BST_MEDIA_LIBRARY_<адрес>`) показывает его сразу после запуска и держит
// изменения, пока сервер чатов недоступен. С сервером стор связывает
// мессенджер: он входит в Matrix и пересылает сюда изменения с других
// устройств (`applyRemote`), как и для списка каналов.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { MEDIA_LIBRARY_PREFIX } from '@/blockchain/constants/storage'
import { matrixService } from '@/b-components/messenger/services/matrix-service'
import { logger } from '@/services/logger'
import {
  MEDIA_LIBRARY_ACCOUNT_DATA,
  PLAYLIST_PREFIX,
  createPlaylist as createPlaylistIn,
  deletePlaylist as deletePlaylistIn,
  emptyLibraryDoc,
  hasItem,
  listItemIds,
  mergeLibraryDoc,
  moveItem as moveItemIn,
  parseLibraryDoc,
  playlistIds,
  pruneLibraryDoc,
  renamePlaylist as renamePlaylistIn,
  sameLibraryDoc,
  setItem,
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

  function persist(): void {
    if (!owner.value) return
    try {
      storage()?.setItem(`${MEDIA_LIBRARY_PREFIX}${owner.value}`, JSON.stringify(doc.value))
    } catch {
      /* переполнение — останется в памяти до следующего раза */
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

  function attach(address: string): void {
    if (owner.value === address) return
    reset()
    owner.value = address
    doc.value = readStored(address)
    // Клиент Matrix уже работает (вошли раньше, чем открыли раздел): серверная копия есть.
    if (matrixService.getClient()) syncWithServer()
  }

  function reset(): void {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = null
    dirty = false
    owner.value = null
    doc.value = emptyLibraryDoc()
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

  // --- Изменения пользователем ---

  function toggle(listId: string, txid: string, on: boolean): boolean {
    return change(setItem(doc.value, listId, txid, on, Date.now()))
  }

  function move(listId: string, txid: string, index: number): boolean {
    return change(moveItemIn(doc.value, listId, txid, index, Date.now()))
  }

  /** Новый личный плейлист; null — предел числа плейлистов. */
  function createPlaylist(kind: LibraryKind, name: string): string | null {
    const id = randomPlaylistId()
    return change(createPlaylistIn(doc.value, id, kind, name, Date.now())) ? id : null
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
    toggle,
    move,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
  }
})
