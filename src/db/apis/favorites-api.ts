import { db } from '../database'
import type { FavoritePost } from '../types'

/**
 * API для хранилища избранных постов в IDB (таблица favorites).
 */
export const favoritesAPI = {
  /**
   * Добавить пост в избранное
   */
  async add(id: string): Promise<void> {
    await db.favorites.put({ id, addedAt: Date.now() })
  },

  /**
   * Удалить пост из избранного
   */
  async remove(id: string): Promise<void> {
    await db.favorites.delete(id)
  },

  /**
   * Проверить, есть ли пост в избранном
   */
  async has(id: string): Promise<boolean> {
    const item = await db.favorites.get(id)
    return !!item
  },

  /**
   * Список избранных по дате добавления (новые сверху), с пагинацией
   */
  async getList(limit?: number, offset?: number): Promise<FavoritePost[]> {
    let collection = db.favorites.orderBy('addedAt').reverse()
    if (offset) collection = collection.offset(offset)
    if (limit) collection = collection.limit(limit)
    return await collection.toArray()
  },

  /**
   * Все ID избранных постов (для фильтрации ленты)
   */
  async getAllIds(): Promise<string[]> {
    const items = await db.favorites.orderBy('addedAt').reverse().toArray()
    return items.map((item) => item.id)
  }
}
