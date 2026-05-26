/**
 * Async-обёртка над key-value хранилищем для mini-apps.
 *
 * На mobile/Tauri-сборках использует `@capacitor/preferences` (на iOS — Keychain,
 * на Android — EncryptedSharedPreferences). В браузере деградирует до `localStorage`.
 * Это закрывает §1.6: legacy хранил permissions в plain `localStorage`, в нашем
 * новом коде permissions и реестр локальных приложений идут через защищённое хранилище.
 *
 * Все ключи namespace-нутся префиксом `mini-apps:`, чтобы не конфликтовать с
 * другими модулями приложения.
 */

import { logger } from '@/services/logger'

const log = logger.scope('[mini-apps:kv]')

const NAMESPACE = 'mini-apps:'

export interface KeyValueStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  /** Возвращает все ключи в namespace (без префикса). */
  keys(): Promise<string[]>
}

// Lazy-init: модуль `@capacitor/preferences` грузим только если приложение реально
// запущено в Capacitor (Android/iOS/Electron). В обычном браузере и в vitest
// сразу деградируем на localStorage — иначе web-impl Capacitor падает на jsdom-окружении.
let capacitorPrefs: typeof import('@capacitor/preferences') | null = null
let capacitorChecked = false

async function getCapacitor(): Promise<typeof import('@capacitor/preferences') | null> {
  if (capacitorChecked) return capacitorPrefs
  capacitorChecked = true
  try {
    const core = await import('@capacitor/core')
    if (!core.Capacitor?.isNativePlatform?.()) {
      log.debug('not a native Capacitor platform — using localStorage')
      capacitorPrefs = null
      return capacitorPrefs
    }
    capacitorPrefs = await import('@capacitor/preferences')
  } catch (e) {
    log.debug('Capacitor unavailable, falling back to localStorage', e)
    capacitorPrefs = null
  }
  return capacitorPrefs
}

const capacitorBackend: KeyValueStore = {
  async get(key) {
    const mod = await getCapacitor()
    if (!mod) return null
    const { value } = await mod.Preferences.get({ key: NAMESPACE + key })
    return value ?? null
  },
  async set(key, value) {
    const mod = await getCapacitor()
    if (!mod) return
    await mod.Preferences.set({ key: NAMESPACE + key, value })
  },
  async remove(key) {
    const mod = await getCapacitor()
    if (!mod) return
    await mod.Preferences.remove({ key: NAMESPACE + key })
  },
  async keys() {
    const mod = await getCapacitor()
    if (!mod) return []
    const { keys } = await mod.Preferences.keys()
    return keys.filter((k) => k.startsWith(NAMESPACE)).map((k) => k.slice(NAMESPACE.length))
  },
}

const localStorageBackend: KeyValueStore = {
  async get(key) {
    try {
      return window.localStorage.getItem(NAMESPACE + key)
    } catch {
      return null
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(NAMESPACE + key, value)
    } catch (e) {
      log.warn('localStorage.setItem failed', e)
    }
  },
  async remove(key) {
    try {
      window.localStorage.removeItem(NAMESPACE + key)
    } catch {
      // ignore
    }
  },
  async keys() {
    try {
      const result: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k?.startsWith(NAMESPACE)) result.push(k.slice(NAMESPACE.length))
      }
      return result
    } catch {
      return []
    }
  },
}

/**
 * Возвращает текущий backend. На каждом вызове проверяет доступность Capacitor —
 * в production это no-op (флаг кэшируется внутри `getCapacitor`).
 */
async function pickBackend(): Promise<KeyValueStore> {
  const cap = await getCapacitor()
  return cap ? capacitorBackend : localStorageBackend
}

/** Дефолтный async-store, который сам выбирает backend. */
export const kvStore: KeyValueStore = {
  async get(key) {
    return (await pickBackend()).get(key)
  },
  async set(key, value) {
    return (await pickBackend()).set(key, value)
  },
  async remove(key) {
    return (await pickBackend()).remove(key)
  },
  async keys() {
    return (await pickBackend()).keys()
  },
}

/** Создаёт in-memory backend для тестов. */
export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>()
  return {
    async get(key) {
      return map.get(key) ?? null
    },
    async set(key, value) {
      map.set(key, value)
    },
    async remove(key) {
      map.delete(key)
    },
    async keys() {
      return [...map.keys()]
    },
  }
}
