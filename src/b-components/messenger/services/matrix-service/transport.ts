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
 * IndexedDBStore пользователя: matrix-js-sdk сохраняет sync-state на диск, и при
 * следующих запусках `getRooms()` сразу отдаёт комнаты из кэша, без полного
 * initial sync. Поднимает его `startIndexedDbStore` — уже после передачи
 * клиенту. null — IndexedDB недоступен (клиент живёт с MemoryStore).
 */
export function createIndexedDbStore(
  userId: string
): InstanceType<typeof sdk.IndexedDBStore> | null {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return null
  try {
    return new sdk.IndexedDBStore({
      indexedDB: window.indexedDB,
      localStorage: typeof window.localStorage !== 'undefined' ? window.localStorage : undefined,
      dbName: getStoreDbName(userId),
    })
  } catch (e) {
    console.warn('[MatrixService] IndexedDBStore unavailable, using MemoryStore:', e)
    return null
  }
}

/**
 * Поднять хранилище — только после `createClient({ store })`: клиент даёт ему
 * `createUser`, без которого startup падает на сохранённых событиях
 * присутствия. Раньше startup шёл до клиента, и кэш жил один запуск: со
 * второго хранилище всегда откатывалось в память. false — не поднялось, база
 * закрыта, клиент нужен без него.
 */
export async function startIndexedDbStore(
  store: InstanceType<typeof sdk.IndexedDBStore>
): Promise<boolean> {
  try {
    await store.startup()
    return true
  } catch (e) {
    console.warn('[MatrixService] IndexedDBStore init failed, falling back to MemoryStore:', e)
    await store.destroy().catch(() => {})
    return false
  }
}
