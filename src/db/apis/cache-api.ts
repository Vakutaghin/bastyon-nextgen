import { db, withDb } from '../database'

/**
 * Очистка локального кэша (в старом клиенте — «очистить локальное хранилище»).
 *
 * Старый клиент стирал localStorage целиком, кроме мнемоники. Так делать нельзя:
 * вместе с кэшем улетали бы черновики и незавершённые действия. Поэтому здесь
 * перечислены ровно те таблицы, содержимое которых приложение умеет получить
 * заново, — а аккаунты, ключи, настройки, избранное и неотправленные оценки
 * не трогаются.
 */
const CACHE_TABLES = [
  'transcodedVideos',
  'videoProgress',
  'decryptedMessages',
  'notifications',
] as const

export interface CacheClearResult {
  /** Сколько записей удалено суммарно. */
  removed: number
}

export const cacheAPI = {
  /** Сколько записей сейчас занимает кэш. */
  async size(): Promise<number> {
    return withDb(0, async () => {
      let total = 0
      for (const name of CACHE_TABLES) {
        total += await db.table(name).count()
      }
      return total
    })
  },

  /** Очистить кэш. Возвращает, сколько записей было удалено. */
  async clear(): Promise<CacheClearResult> {
    return withDb<CacheClearResult>({ removed: 0 }, async () => {
      let removed = 0
      for (const name of CACHE_TABLES) {
        const table = db.table(name)
        removed += await table.count()
        await table.clear()
      }
      return { removed }
    })
  },
}
