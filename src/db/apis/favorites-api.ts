import { db } from '../database'
import type { FavoritePost } from '../types'

/**
 * API для хранилища избранных постов в IDB (таблица favorites), per-account
 * (N10/Р5): ключ — (address, id). Аноним/legacy — address ''. Записи '' при
 * первом обращении аккаунта переезжают к нему (adoptLegacy).
 */
const adopted = new Set<string>()

export const favoritesAPI = {
  /** Legacy-избранное (без адреса) → первому аккаунту, который спросил. Идемпотентно. */
  async adoptLegacy(address: string): Promise<void> {
    if (!address || adopted.has(address)) return
    adopted.add(address)
    await db.transaction('rw', db.favorites, async () => {
      const legacy = await db.favorites.where('address').equals('').toArray()
      if (legacy.length === 0) return
      await db.favorites.bulkDelete(legacy.map((r) => [r.address, r.id] as [string, string]))
      await db.favorites.bulkPut(legacy.map((r) => ({ ...r, address })))
    })
  },

  /**
   * Добавить пост в избранное
   */
  async add(address: string, id: string): Promise<void> {
    await db.favorites.put({ address, id, addedAt: Date.now() })
  },

  /**
   * Удалить пост из избранного
   */
  async remove(address: string, id: string): Promise<void> {
    await db.favorites.delete([address, id])
  },

  /**
   * Проверить, есть ли пост в избранном
   */
  async has(address: string, id: string): Promise<boolean> {
    await this.adoptLegacy(address)
    const item = await db.favorites.get([address, id])
    return !!item
  },

  /**
   * Список избранных по дате добавления (новые сверху), с пагинацией
   */
  async getList(address: string, limit?: number, offset?: number): Promise<FavoritePost[]> {
    await this.adoptLegacy(address)
    const items = await db.favorites.where('address').equals(address).sortBy('addedAt')
    let list = items.reverse()
    if (offset) list = list.slice(offset)
    if (limit) list = list.slice(0, limit)
    return list
  },

  /**
   * Все ID избранных постов (для фильтрации ленты)
   */
  async getAllIds(address: string): Promise<string[]> {
    await this.adoptLegacy(address)
    const items = await db.favorites.where('address').equals(address).sortBy('addedAt')
    return items.reverse().map((item) => item.id)
  },

  /** Стереть избранное аккаунта (удаление аккаунта). */
  async purge(address: string): Promise<void> {
    await db.favorites.where('address').equals(address).delete()
  },

  /** Для тестов: забыть, кому уже мигрировали legacy. */
  __resetAdopted(): void {
    adopted.clear()
  },
}
