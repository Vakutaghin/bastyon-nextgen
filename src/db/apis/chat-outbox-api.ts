import { db, withDb } from '../database'
import type { ChatOutboxRecord } from '../types'

/**
 * Неотправленные сообщения (messenger-chat-store/outbox). Записи приходят уже
 * зашифрованными. Всё best-effort: без базы неотправленное живёт до закрытия
 * приложения, как раньше.
 */
export const chatOutboxAPI = {
  async put(record: ChatOutboxRecord): Promise<void> {
    await withDb(undefined, async () => {
      await db.chatOutbox.put(record)
    })
  },

  async remove(account: string, id: string): Promise<void> {
    await withDb(undefined, () => db.chatOutbox.delete([account, id]))
  },

  /** Всё неотправленное аккаунта. */
  async all(account: string): Promise<ChatOutboxRecord[]> {
    return withDb<ChatOutboxRecord[]>([], () =>
      db.chatOutbox.where('account').equals(account).toArray()
    )
  },
}
