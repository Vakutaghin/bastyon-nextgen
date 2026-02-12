import { db } from '../database'
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
    await db.notifications.put(record)
  },

  /**
   * Добавить пачку уведомлений для адреса (новые сверху по nblock)
   */
  async putMany(address: string, items: Omit<StoredNotification, 'address'>[]): Promise<void> {
    const records: StoredNotification[] = items.map((item) => ({ ...item, address }))
    await db.notifications.bulkPut(records)
  },

  /**
   * Все уведомления для адреса, отсортированные по nblock по убыванию (новые сверху)
   */
  async getAllByAddress(address: string): Promise<StoredNotification[]> {
    const list = await db.notifications.where('address').equals(address).toArray()
    return list.sort((a, b) => b.nblock - a.nblock)
  },

  /**
   * Удалить одно уведомление по address+id
   */
  async delete(address: string, id: string): Promise<void> {
    await db.notifications.delete([address, id])
  },

  /**
   * Удалить все уведомления для адреса
   */
  async deleteAllByAddress(address: string): Promise<void> {
    await db.notifications.where('address').equals(address).delete()
  }
}
