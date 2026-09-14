/**
 * Транспорт Matrix: вычисление базового URL homeserver'а и создание
 * IndexedDBStore (персистентный sync-state, "state restore"). Вынесено из
 * `MatrixService`, чтобы изолировать настройку соединения/хранилища.
 */
import * as sdk from 'matrix-js-sdk'

export { getDefaultMatrixBaseUrl, getProductionMatrixBaseUrl } from './matrix-base-url'

/**
 * Имя БД для IndexedDBStore — отдельное на каждого matrix-юзера,
 * чтобы при смене аккаунта sync-данные не пересекались.
 */
export function getStoreDbName(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_.-]/g, '_')
  return `bastyon-matrix-sync:${safe}`
}

const SYNC_DB_PREFIX = 'bastyon-matrix-sync:'

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.deleteDatabase(name)
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Стирает sync-state matrix-js-sdk с диска (V15/Р6): при выходе — БД текущего
 * юзера; при удалении аккаунта — все БД с его hex-частью id (домен неизвестен,
 * `indexedDB.databases()` есть в Chromium/WebKit ≥ 14; без него — только точное имя).
 * Best-effort: открытые соединения должны быть закрыты до вызова (matrixService.stop()).
 */
export async function deleteSyncStores(opts: { userId?: string; userHex?: string }): Promise<void> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return
  const names = new Set<string>()
  if (opts.userId) names.add(getStoreDbName(opts.userId))
  if (opts.userHex) {
    const marker = `${SYNC_DB_PREFIX}_${opts.userHex.toLowerCase()}_`
    try {
      const listed = (await window.indexedDB.databases?.()) ?? []
      for (const d of listed) if (d.name && d.name.startsWith(marker)) names.add(d.name)
    } catch {
      /* databases() недоступен — ограничиваемся точным именем */
    }
  }
  await Promise.all([...names].map(deleteDb))
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
