import { db } from '../database'
import { setTimestamps } from '../utils'
import type { ContentCache } from '../types'

/**
 * API для работы с кэшем контента
 */
export const cacheAPI = {
  /**
   * Сохранить данные в кэш
   */
  async set(key: string, data: any, ttl?: number): Promise<string> {
    const cacheItem: ContentCache = {
      key,
      data,
      expiresAt: ttl ? Date.now() + ttl : undefined,
      ...setTimestamps({} as ContentCache, true)
    }
    return await db.contentCache.put(cacheItem)
  },

  /**
   * Получить данные из кэша
   */
  async get(key: string): Promise<any | undefined> {
    const item = await db.contentCache.get(key)
    if (!item) return undefined

    // Проверяем срок действия
    if (item.expiresAt && item.expiresAt < Date.now()) {
      await db.contentCache.delete(key)
      return undefined
    }

    return item.data
  },

  /**
   * Удалить элемент из кэша
   */
  async delete(key: string): Promise<void> {
    await db.contentCache.delete(key)
  },

  /**
   * Очистить просроченный кэш
   */
  async clearExpired(): Promise<number> {
    const now = Date.now()
    const expired = await db.contentCache
      .where('expiresAt')
      .below(now)
      .toArray()

    const keys = expired.map(item => item.key)
    await db.contentCache.bulkDelete(keys)
    return keys.length
  },

  /**
   * Очистить весь кэш
   */
  async clearAll(): Promise<void> {
    await db.contentCache.clear()
  }
}
