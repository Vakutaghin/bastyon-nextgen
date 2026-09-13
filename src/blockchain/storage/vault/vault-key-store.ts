// Инъектируемый бэкенд для device-ключа обёртки сейфа (P0-1).
//
// Бэкенд сам МИНТИТ ключ (createKey) — так Capacitor-бэкенд может хранить сырые
// байты в нативном хранилище и импортировать их как non-extractable CryptoKey,
// а IndexedDB-бэкенд — держать non-extractable ключ, который в JS не выгружается.
//
// Дефолт в браузере/Tauri — сырой IndexedDB (отдельная БД `bastyon-vault`, НЕ
// Dexie/BastyonDB, чтобы доступность сейфа не зависела от схемы/миграций
// приложения). Хранит один non-extractable CryptoKey под фиксированным id. Каждая
// операция гонится против таймаута — залипшая IDB не должна вешать бут (fix [B1]).
//
// На мобиле (Capacitor native) — vault-key-store-capacitor: IndexedDB в WKWebView
// вытесняется ITP через 7 дней неактивности, что превращалось в потерю аккаунта (VP-2).
//
// Тесты инъектируют createMemoryVaultKeyStore() (happy-dom не даёт indexedDB).

import { generateDeviceKey } from './vault-crypto'

export interface VaultKeyStore {
  getKey(): Promise<CryptoKey | null>
  /**
   * Создаёт НОВЫЙ device-ключ и durable сохраняет его (для IDB — ждём
   * transaction.oncomplete, не request.onsuccess, иначе ключ может не долежать
   * до коммита [C3]). Заменяет прежний ключ.
   */
  createKey(): Promise<CryptoKey>
  deleteKey(): Promise<void>
}

const DB_NAME = 'bastyon-vault'
const STORE = 'keys'
const RECORD_ID = 'wrap'
const OP_TIMEOUT_MS = 2500

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`vault-key-store: ${label} timed out`)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

function openDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('vault-key-store: indexedDB unavailable'))
      return
    }
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, 1)
    } catch (e) {
      reject(e instanceof Error ? e : new Error('vault-key-store: open threw'))
      return
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('vault-key-store: open failed'))
    req.onblocked = () => reject(new Error('vault-key-store: open blocked'))
  })
}

async function runTx<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest | null,
  read: boolean,
  label: string
): Promise<T> {
  const db = await withTimeout(openDb(), OP_TIMEOUT_MS, `${label}:open`)
  try {
    return await withTimeout(
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = op(tx.objectStore(STORE))
        // Для read отдаём результат запроса; для write ждём коммит транзакции [C3].
        if (read) {
          tx.onerror = () => reject(tx.error ?? new Error(`${label}: tx error`))
          tx.onabort = () => reject(tx.error ?? new Error(`${label}: tx abort`))
          if (req) req.onsuccess = () => resolve((req.result as T) ?? (null as unknown as T))
          if (req) req.onerror = () => reject(req.error ?? new Error(`${label}: req error`))
        } else {
          tx.oncomplete = () => resolve(undefined as unknown as T)
          tx.onerror = () => reject(tx.error ?? new Error(`${label}: tx error`))
          tx.onabort = () => reject(tx.error ?? new Error(`${label}: tx abort`))
        }
      }),
      OP_TIMEOUT_MS,
      label
    )
  } finally {
    try {
      db.close()
    } catch {
      /* ignore */
    }
  }
}

export const indexedDbVaultKeyStore: VaultKeyStore = {
  getKey() {
    return runTx<CryptoKey | null>('readonly', (s) => s.get(RECORD_ID), true, 'getKey')
  },
  async createKey() {
    const key = await generateDeviceKey()
    await runTx<void>('readwrite', (s) => s.put(key, RECORD_ID), false, 'createKey')
    return key
  },
  deleteKey() {
    return runTx<void>('readwrite', (s) => s.delete(RECORD_ID), false, 'deleteKey')
  },
}

/** In-memory бэкенд для тестов (happy-dom без indexedDB) и degraded-окружений. */
export function createMemoryVaultKeyStore(): VaultKeyStore {
  let stored: CryptoKey | null = null
  return {
    async getKey() {
      return stored
    },
    async createKey() {
      stored = await generateDeviceKey()
      return stored
    },
    async deleteKey() {
      stored = null
    },
  }
}

/**
 * Дефолтный бэкенд приложения: на нативной платформе Capacitor — нативное
 * хранилище (см. vault-key-store-capacitor), иначе IndexedDB. Выбор ленивый и
 * однократный: `@capacitor/core` подгружается динамически (в браузере и vitest
 * его web-реализация не нужна).
 */
export function createPlatformVaultKeyStore(): VaultKeyStore {
  let backend: Promise<VaultKeyStore> | null = null
  const pick = (): Promise<VaultKeyStore> => {
    if (!backend) {
      backend = (async () => {
        try {
          const core = await import('@capacitor/core')
          if (core.Capacitor?.isNativePlatform?.()) {
            const [{ Preferences }, { createCapacitorVaultKeyStore }] = await Promise.all([
              import('@capacitor/preferences'),
              import('./vault-key-store-capacitor'),
            ])
            return createCapacitorVaultKeyStore(Preferences)
          }
        } catch {
          /* не Capacitor — IndexedDB */
        }
        return indexedDbVaultKeyStore
      })()
    }
    return backend
  }
  return {
    getKey: () => pick().then((b) => b.getKey()),
    createKey: () => pick().then((b) => b.createKey()),
    deleteKey: () => pick().then((b) => b.deleteKey()),
  }
}
