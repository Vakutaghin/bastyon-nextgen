import { db, withDb } from '../database'
import type { StoredNotification } from '../types'

/**
 * API для хранилища уведомлений в IDB.
 * Ключ: [address, id]. Уведомления докладываются сверху по мере получения.
 */
export const notificationsAPI = {
  /**
   * Добавить или обновить уведомление (по address+id)
   */
  async put(address: string, item: Omit<StoredNotification, 'address'>): Promise<void> {
    const record: StoredNotification = { ...item, address }
    // Кэш уведомлений не критичен: при недоступной базе просто не пишем (S61).
    await withDb(undefined, () => db.notifications.put(record).then(() => undefined))
  },

  /**
   * Добавить пачку уведомлений для адреса (новые сверху по nblock)
   */
  async putMany(address: string, items: Omit<StoredNotification, 'address'>[]): Promise<void> {
    const records: StoredNotification[] = items.map((item) => ({ ...item, address }))
    await withDb(undefined, () => db.notifications.bulkPut(records).then(() => undefined))
  },

  /**
   * Все уведомления для адреса, отсортированные по nblock по убыванию (новые сверху)
   */
  async getAllByAddress(address: string): Promise<StoredNotification[]> {
    return withDb<StoredNotification[]>([], async () => {
      const list = await db.notifications.where('address').equals(address).toArray()
      return list.sort((a, b) => b.nblock - a.nblock)
    })
  },

  /**
   * Удалить одно уведомление по address+id
   */
  async delete(address: string, id: string): Promise<void> {
    await withDb(undefined, () => db.notifications.delete([address, id]))
  },

  /**
   * Удалить пачку уведомлений по address+id (чистка старых записей, S53)
   */
  async deleteMany(address: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await withDb(undefined, () => db.notifications.bulkDelete(ids.map((id) => [address, id])))
  },

  /**
   * Удалить все уведомления для адреса
   */
  async deleteAllByAddress(address: string): Promise<void> {
    await withDb(undefined, () =>
      db.notifications
        .where('address')
        .equals(address)
        .delete()
        .then(() => undefined)
    )
  },
}
