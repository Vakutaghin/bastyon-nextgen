/**
 * In-memory кэш расшифрованных текстов сообщений по event_id с зеркалом в IndexedDB.
 *
 * Зачем нужен: расшифровка одного сообщения — это PBKDF2×2 + EAA + secp256k1, а
 * Matrix-таймлайн читает события на каждый re-render. Без кэша даже 30 сообщений
 * в открытой комнате создавали бы заметный лаг при прокрутке.
 *
 * События матрицы иммутабельны (новый event_id при правке), поэтому кэшировать
 * по event_id безопасно — однажды расшифрованный текст не «протухает».
 *
 * IDB-зеркало: hydrate() поднимает все расшифровки пользователя в память пачкой
 * после инициализации pcrypto. saveDecrypted мы не ждём — пишется в фоне.
 *
 * Кэшируем ТОЛЬКО успехи: при сбое (например, не приехал state-event общего ключа)
 * следующий проход попробует ещё раз.
 */

import {
  loadAllDecryptedForUser,
  saveDecrypted,
  clearDecryptedForUser,
} from '@/db/apis/decrypted-messages-api'

export interface DecryptionCache {
  get(eventId: string): string | undefined
  set(eventId: string, text: string): void
  has(eventId: string): boolean
  hydrate(userId: string | null | undefined): Promise<void>
  purge(userId: string | null | undefined): Promise<void>
  /** Сброс кэша в памяти без затрагивания IDB (вызывается при логауте). */
  resetInMemory(): void
  /** Persistent write — fire-and-forget. */
  persist(userId: string | null | undefined, eventId: string, text: string): void
}

export function createDecryptionCache(): DecryptionCache {
  const cache = new Map<string, string>()
  let hydrated = false
  let hydrating: Promise<void> | null = null

  return {
    get: (eventId) => cache.get(eventId),
    has: (eventId) => cache.has(eventId),
    set: (eventId, text) => {
      cache.set(eventId, text)
    },

    hydrate: (userId) => {
      if (hydrated) return Promise.resolve()
      if (hydrating) return hydrating
      if (!userId) return Promise.resolve()
      hydrating = (async () => {
        try {
          const rows = await loadAllDecryptedForUser(userId)
          for (const r of rows) {
            if (!cache.has(r.eventId)) cache.set(r.eventId, r.text)
          }
        } catch (e) {
          console.warn('[decryption-cache] hydrate failed', e)
        } finally {
          hydrated = true
          hydrating = null
        }
      })()
      return hydrating
    },

    purge: async (userId) => {
      cache.clear()
      hydrated = false
      hydrating = null
      if (userId) await clearDecryptedForUser(userId)
    },

    resetInMemory: () => {
      cache.clear()
      hydrated = false
      hydrating = null
      // IDb-кэш расшифровок не трогаем: при повторном логине того же аккаунта он сразу
      // даст ускорение. Очистка для конкретного юзера доступна через purge().
    },

    persist: (userId, eventId, text) => {
      if (!userId) return
      void saveDecrypted(userId, eventId, text).catch((e) => {
        console.warn('[decryption-cache] persist failed', e)
      })
    },
  }
}
