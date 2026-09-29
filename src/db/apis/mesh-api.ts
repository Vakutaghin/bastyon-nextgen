import Dexie from 'dexie'
import { db, withDb } from '../database'
import type { MeshDialogRecord, MeshMessageRecord } from '../types'

/**
 * Переписка в mesh-сетях (src/mesh). Радио историю не хранит: забранное
 * приложением сообщение из его памяти удаляется, поэтому единственная копия —
 * здесь. Все записи привязаны к аккаунту Bastyon (Р5).
 *
 * Недоступная база (S61) не роняет чат: чтение отдаёт пусто, запись молча
 * пропускается — переписка тогда живёт до перезапуска.
 */

/** Сколько последних сообщений поднимать при открытии диалога. */
export const MESH_HISTORY_LIMIT = 500

export const meshAPI = {
  async dialogs(account: string): Promise<MeshDialogRecord[]> {
    if (!account) return []
    return withDb([], () => db.meshDialogs.where('account').equals(account).toArray())
  },

  async putDialog(dialog: MeshDialogRecord): Promise<void> {
    await withDb(undefined, () => db.meshDialogs.put(dialog).then(() => undefined))
  },

  /** Диалог вместе с его сообщениями. */
  async deleteDialog(id: string): Promise<void> {
    await withDb(undefined, () =>
      db.transaction('rw', db.meshDialogs, db.meshMessages, async () => {
        await db.meshMessages
          .where('[dialogId+ts]')
          .between([id, Dexie.minKey], [id, Dexie.maxKey])
          .delete()
        await db.meshDialogs.delete(id)
      })
    )
  },

  /** Последние `limit` сообщений диалога по порядку (старые сверху). */
  async messages(dialogId: string, limit = MESH_HISTORY_LIMIT): Promise<MeshMessageRecord[]> {
    const newestFirst = await withDb([], () =>
      db.meshMessages
        .where('[dialogId+ts]')
        .between([dialogId, Dexie.minKey], [dialogId, Dexie.maxKey])
        .reverse()
        .limit(limit)
        .toArray()
    )
    return newestFirst.reverse()
  },

  /**
   * Сохранить сообщение. `false` — такое уже есть (тот же `dedupKey`): повтор
   * ЛС, который радио прислало ещё раз.
   */
  async addMessage(message: MeshMessageRecord): Promise<boolean> {
    return withDb(true, async () => {
      try {
        await db.meshMessages.add(message)
        return true
      } catch (e) {
        if ((e as { name?: string })?.name === 'ConstraintError') return false
        throw e
      }
    })
  },

  async updateMessage(id: string, patch: Partial<MeshMessageRecord>): Promise<void> {
    await withDb(undefined, () => db.meshMessages.update(id, patch).then(() => undefined))
  },

  /** Всё аккаунта: при выходе и удалении аккаунта. */
  async purgeAccount(account: string): Promise<void> {
    if (!account) return
    await withDb(undefined, () =>
      db.transaction('rw', db.meshDialogs, db.meshMessages, async () => {
        await db.meshMessages.where('account').equals(account).delete()
        await db.meshDialogs.where('account').equals(account).delete()
      })
    )
  },
}
