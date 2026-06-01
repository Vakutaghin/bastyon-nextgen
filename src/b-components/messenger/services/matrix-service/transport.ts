/**
 * Транспорт Matrix: вычисление базового URL homeserver'а и создание
 * IndexedDBStore (персистентный sync-state, "state restore"). Вынесено из
 * `MatrixService`, чтобы изолировать настройку соединения/хранилища.
 */
import * as sdk from 'matrix-js-sdk'

import servers from '@/servers.json'

export function getDefaultMatrixBaseUrl(): string {
  const host = servers.servers?.production?.matrix ?? 'matrix.pocketnet.app'
  const prodUrl = host.startsWith('http') ? host : `https://${host}`
  if (!import.meta.env.DEV) return prodUrl
  // In Tauri tauriFetch isn't subject to CORS, so skip the Vite /_matrix proxy
  // and talk to the homeserver directly (which is also what's allowed by the HTTP scope).
  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  return inTauri ? prodUrl : window.location.origin
}

/**
 * Имя БД для IndexedDBStore — отдельное на каждого matrix-юзера,
 * чтобы при смене аккаунта sync-данные не пересекались.
 */
export function getStoreDbName(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_.-]/g, '_')
  return `bastyon-matrix-sync:${safe}`
}

/**
 * Создаёт и поднимает IndexedDBStore для пользователя. matrix-js-sdk сохраняет
 * sync-state на диск, и при последующих запусках `getRooms()` сразу возвращает
 * комнаты из кэша, без полного initial sync. Возвращает null, если IndexedDB
 * недоступен или инициализация упала (вызывающий откатится на MemoryStore).
 */
export async function createIndexedDbStore(
  userId: string
): Promise<InstanceType<typeof sdk.IndexedDBStore> | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return null
  try {
    const store = new sdk.IndexedDBStore({
      indexedDB: window.indexedDB,
      localStorage: typeof window.localStorage !== 'undefined' ? window.localStorage : undefined,
      dbName: getStoreDbName(userId),
    })
    await store.startup()
    return store
  } catch (e) {
    console.warn('[MatrixService] IndexedDBStore init failed, falling back to MemoryStore:', e)
    return null
  }
}
