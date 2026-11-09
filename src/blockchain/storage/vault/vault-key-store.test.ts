import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
  createMemoryVaultKeyStore,
  createPlatformVaultKeyStore,
  indexedDbVaultKeyStore,
} from './vault-key-store'
import {
  createCapacitorVaultKeyStore,
  CAPACITOR_VAULT_KEY,
  type PreferencesLike,
} from './vault-key-store-capacitor'
import { generateSecret, wrapSecret, unwrapSecret, bytesToB64 } from './vault-crypto'

// Контракт in-memory бэкенда (инъектируется в тестах crypto-vault), реального
// IndexedDB-бэкенда (поверх fake-indexeddb + ручные заглушки для зависаний и
// сбоев), Capacitor-бэкенда (VP-2) и выбора платформенного дефолта.

// Платформа Capacitor управляется из теста: по умолчанию — не нативная (как в vitest).
const cap = vi.hoisted(() => ({
  mode: 'web' as 'web' | 'native' | 'throw',
  isNativeCalls: 0,
  prefs: new Map<string, string>(),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => {
      cap.isNativeCalls++
      if (cap.mode === 'throw') throw new Error('capacitor bridge missing')
      return cap.mode === 'native'
    },
  },
}))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    async get({ key }: { key: string }) {
      return { value: cap.prefs.get(key) ?? null }
    },
    async set({ key, value }: { key: string; value: string }) {
      cap.prefs.set(key, value)
    },
    async remove({ key }: { key: string }) {
      cap.prefs.delete(key)
    },
  },
}))

/** Конверт, сделанный ключом `key`, разворачивается ключом `other` — тот же ключ. */
async function sameKey(key: CryptoKey, other: CryptoKey): Promise<boolean> {
  const secret = generateSecret()
  const env = await wrapSecret(key, secret)
  try {
    return bytesToB64(await unwrapSecret(other, env)) === bytesToB64(secret)
  } catch {
    return false
  }
}

describe('createMemoryVaultKeyStore', () => {
  it('get до create → null', async () => {
    const ks = createMemoryVaultKeyStore()
    expect(await ks.getKey()).toBeNull()
  })

  it('create → get возвращает тот же CryptoKey (годный для unwrap)', async () => {
    const ks = createMemoryVaultKeyStore()
    const key = await ks.createKey()
    const got = await ks.getKey()
    expect(got).not.toBeNull()

    // Ключ функционально тот же: конверт, сделанный на исходном, разворачивается полученным.
    const secret = generateSecret()
    const env = await wrapSecret(key, secret)
    expect(bytesToB64(await unwrapSecret(got!, env))).toBe(bytesToB64(secret))
  })

  it('delete → get → null', async () => {
    const ks = createMemoryVaultKeyStore()
    await ks.createKey()
    await ks.deleteKey()
    expect(await ks.getKey()).toBeNull()
  })
})

describe('indexedDbVaultKeyStore (fake-indexeddb)', () => {
  beforeEach(() => {
    // Свежая «браузерная» IndexedDB на каждый кейс.
    vi.stubGlobal('indexedDB', new IDBFactory())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('на чистом устройстве ключа нет', async () => {
    expect(await indexedDbVaultKeyStore.getKey()).toBeNull()
  })

  it('созданный ключ переживает «перезапуск» и не выгружается из JS', async () => {
    const key = await indexedDbVaultKeyStore.createKey()
    // Каждый вызов открывает своё подключение — это и есть чтение «после рестарта».
    const got = await indexedDbVaultKeyStore.getKey()
    expect(got).not.toBeNull()
    expect(got!.extractable).toBe(false)
    expect(await sameKey(key, got!)).toBe(true)
    await expect(globalThis.crypto.subtle.exportKey('raw', got!)).rejects.toBeTruthy()
  })

  it('повторный create заменяет ключ: конверты под прежним больше не открываются', async () => {
    const first = await indexedDbVaultKeyStore.createKey()
    const second = await indexedDbVaultKeyStore.createKey()
    const got = await indexedDbVaultKeyStore.getKey()
    expect(await sameKey(second, got!)).toBe(true)
    expect(await sameKey(first, got!)).toBe(false)
  })

  it('delete стирает ключ; повторный delete на пустой базе не бросает', async () => {
    await indexedDbVaultKeyStore.createKey()
    await indexedDbVaultKeyStore.deleteKey()
    expect(await indexedDbVaultKeyStore.getKey()).toBeNull()
    await expect(indexedDbVaultKeyStore.deleteKey()).resolves.toBeUndefined()
  })
})

/**
 * Ручная IndexedDB: тест сам решает, когда (и сработают ли вообще) колбэки
 * открытия, запроса и транзакции.
 */
function manualIdb() {
  const opReq: Record<string, unknown> & {
    result?: unknown
    error?: unknown
    onsuccess?: () => void
    onerror?: () => void
  } = {}
  const tx: Record<string, unknown> & {
    error?: unknown
    oncomplete?: () => void
    onerror?: () => void
    onabort?: () => void
  } = {
    objectStore: () => ({ get: () => opReq, put: () => opReq, delete: () => opReq }),
  }
  const db = {
    objectStoreNames: { contains: () => true },
    transaction: vi.fn(() => tx),
    close: vi.fn(),
  }
  const openReq: Record<string, unknown> & {
    result: typeof db
    error?: unknown
    onsuccess?: () => void
    onerror?: () => void
    onblocked?: () => void
  } = { result: db }
  const factory = { open: vi.fn(() => openReq) }
  return { factory, openReq, db, tx, opReq }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('indexedDbVaultKeyStore: зависания и сбои хранилища', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('зависшее открытие базы не вешает бут: через 2.5 с операция отклоняется', async () => {
    vi.useFakeTimers()
    const idb = manualIdb()
    vi.stubGlobal('indexedDB', idb.factory)

    const p = indexedDbVaultKeyStore.getKey()
    const settled = expect(p).rejects.toThrow(/getKey:open timed out/)
    await vi.advanceTimersByTimeAsync(2_500)
    await settled
  })

  it('зависшая транзакция тоже отклоняется по таймауту, подключение закрывается', async () => {
    vi.useFakeTimers()
    const idb = manualIdb()
    vi.stubGlobal('indexedDB', idb.factory)

    const p = indexedDbVaultKeyStore.deleteKey()
    const settled = expect(p).rejects.toThrow(/deleteKey timed out/)
    idb.openReq.onsuccess!()
    await vi.advanceTimersByTimeAsync(2_500)
    await settled
    expect(idb.db.close).toHaveBeenCalled()
  })

  it('открытие заблокировано другой вкладкой → понятная ошибка', async () => {
    const idb = manualIdb()
    vi.stubGlobal('indexedDB', idb.factory)
    const p = indexedDbVaultKeyStore.getKey()
    idb.openReq.onblocked!()
    await expect(p).rejects.toThrow(/open blocked/)
  })

  it('ошибка открытия пробрасывается как есть', async () => {
    const idb = manualIdb()
    vi.stubGlobal('indexedDB', idb.factory)
    const p = indexedDbVaultKeyStore.getKey()
    idb.openReq.error = new Error('UnknownError: disk I/O')
    idb.openReq.onerror!()
    await expect(p).rejects.toThrow('UnknownError: disk I/O')
  })

  it('синхронно бросающий open (SecurityError в приватном режиме) → reject, а не исключение', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('SecurityError: access denied')
      },
    })
    await expect(indexedDbVaultKeyStore.getKey()).rejects.toThrow('SecurityError: access denied')
  })

  it('createKey не сообщает успех, пока транзакция не закоммичена [C3]', async () => {
    const idb = manualIdb()
    vi.stubGlobal('indexedDB', idb.factory)
    let done = false
    const p = indexedDbVaultKeyStore.createKey().then((k) => {
      done = true
      return k
    })
    await vi.waitFor(() => expect(idb.factory.open).toHaveBeenCalled())
    idb.openReq.onsuccess!()
    await vi.waitFor(() => expect(idb.db.transaction).toHaveBeenCalledWith('keys', 'readwrite'))

    // put «успешен», но коммита ещё не было — ключ мог не долежать до диска.
    idb.opReq.onsuccess?.()
    await flush()
    expect(done).toBe(false)

    idb.tx.oncomplete!()
    const key = await p
    expect(key.type).toBe('secret')
    expect(idb.db.close).toHaveBeenCalled()
  })

  it('прерванная транзакция записи (квота) → createKey отклоняется, подключение закрыто', async () => {
    const idb = manualIdb()
    vi.stubGlobal('indexedDB', idb.factory)
    const p = indexedDbVaultKeyStore.createKey()
    const settled = expect(p).rejects.toThrow('QuotaExceededError')
    await vi.waitFor(() => expect(idb.factory.open).toHaveBeenCalled())
    idb.openReq.onsuccess!()
    await vi.waitFor(() => expect(idb.db.transaction).toHaveBeenCalled())
    idb.tx.error = new Error('QuotaExceededError')
    idb.tx.onabort!()
    await settled
    expect(idb.db.close).toHaveBeenCalled()
  })

  it('ошибка запроса чтения → getKey отклоняется (а не «ключа нет»)', async () => {
    const idb = manualIdb()
    vi.stubGlobal('indexedDB', idb.factory)
    const p = indexedDbVaultKeyStore.getKey()
    idb.openReq.onsuccess!()
    await vi.waitFor(() => expect(idb.db.transaction).toHaveBeenCalledWith('keys', 'readonly'))
    idb.opReq.error = new Error('DataError')
    idb.opReq.onerror!()
    await expect(p).rejects.toThrow('DataError')
  })
})

function fakePrefs(): PreferencesLike & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    async get({ key }) {
      return { value: store.get(key) ?? null }
    },
    async set({ key, value }) {
      store.set(key, value)
    },
    async remove({ key }) {
      store.delete(key)
    },
  }
}

describe('createCapacitorVaultKeyStore (VP-2)', () => {
  it('create кладёт 32 случайных байта в Preferences; get импортирует non-extractable ключ, годный для unwrap', async () => {
    const prefs = fakePrefs()
    const ks = createCapacitorVaultKeyStore(prefs)
    expect(await ks.getKey()).toBeNull()

    const key = await ks.createKey()
    const stored = prefs.store.get(CAPACITOR_VAULT_KEY)
    expect(stored).toBeTruthy()
    expect(atob(stored!).length).toBe(32)

    const secret = generateSecret()
    const env = await wrapSecret(key, secret)
    // «Перезапуск»: новый инстанс стора поверх тех же Preferences.
    const again = createCapacitorVaultKeyStore(prefs)
    const got = await again.getKey()
    expect(got).not.toBeNull()
    expect(got!.extractable).toBe(false)
    expect(bytesToB64(await unwrapSecret(got!, env))).toBe(bytesToB64(secret))
    await expect(globalThis.crypto.subtle.exportKey('raw', got!)).rejects.toBeTruthy()
  })

  it('повторный create заменяет ключ; delete → null; повреждённое значение → null', async () => {
    const prefs = fakePrefs()
    const ks = createCapacitorVaultKeyStore(prefs)
    await ks.createKey()
    const first = prefs.store.get(CAPACITOR_VAULT_KEY)
    await ks.createKey()
    expect(prefs.store.get(CAPACITOR_VAULT_KEY)).not.toBe(first)

    await ks.deleteKey()
    expect(await ks.getKey()).toBeNull()

    prefs.store.set(CAPACITOR_VAULT_KEY, btoa('short'))
    expect(await ks.getKey()).toBeNull()
  })
})

describe('createPlatformVaultKeyStore', () => {
  beforeEach(() => {
    cap.mode = 'web'
    cap.isNativeCalls = 0
    cap.prefs.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('вне Capacitor (vitest) — IndexedDB-бэкенд; без indexedDB операции реджектят, а не виснут', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const ks = createPlatformVaultKeyStore()
    await expect(ks.getKey()).rejects.toThrow(/indexedDB unavailable/)
  })

  it('в браузере ключ ложится в IndexedDB и читается оттуда же', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    const ks = createPlatformVaultKeyStore()
    const key = await ks.createKey()
    const fromIdb = await indexedDbVaultKeyStore.getKey()
    expect(fromIdb).not.toBeNull()
    expect(await sameKey(key, fromIdb!)).toBe(true)
    expect(cap.prefs.size).toBe(0)
  })

  it('на нативной платформе ключ уходит в Preferences, IndexedDB не трогается', async () => {
    const open = vi.fn()
    vi.stubGlobal('indexedDB', { open })
    cap.mode = 'native'
    const ks = createPlatformVaultKeyStore()

    const key = await ks.createKey()
    expect(cap.prefs.has(CAPACITOR_VAULT_KEY)).toBe(true)
    const got = await ks.getKey()
    expect(await sameKey(key, got!)).toBe(true)
    await ks.deleteKey()
    expect(cap.prefs.has(CAPACITOR_VAULT_KEY)).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })

  it('сломанный мост Capacitor — откат на IndexedDB, а не потеря ключа', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    cap.mode = 'throw'
    const ks = createPlatformVaultKeyStore()
    await ks.createKey()
    expect(await indexedDbVaultKeyStore.getKey()).not.toBeNull()
  })

  it('платформа определяется один раз, даже при параллельных первых вызовах', async () => {
    cap.mode = 'native'
    const ks = createPlatformVaultKeyStore()
    await Promise.all([ks.createKey(), ks.getKey(), ks.getKey()])
    expect(await ks.getKey()).not.toBeNull()
    expect(cap.isNativeCalls).toBe(1)
  })
})
