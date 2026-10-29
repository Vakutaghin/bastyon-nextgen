import Dexie from 'dexie'

import { db, withDb } from '../database'
import type { ChatArchiveChat, ChatArchiveRecord } from '../types'

/**
 * Переписка, сохранённая на устройстве (messenger-archive-store). Записи
 * приходят уже зашифрованными; здесь — только выборки по чату и времени.
 * Всё best-effort: без базы чат работает, как работал без копии.
 */

const MIN = Dexie.minKey
const MAX = Dexie.maxKey

const chatRange = (account: string, chatId: string) =>
  db.chatArchive
    .where('[account+chatId+ts]')
    .between([account, chatId, MIN], [account, chatId, MAX])

export interface ArchiveChatStats {
  count: number
  firstTs: number
  lastTs: number
}

export const chatArchiveAPI = {
  async put(records: ChatArchiveRecord[]): Promise<void> {
    if (!records.length) return
    await withDb(undefined, async () => {
      await db.chatArchive.bulkPut(records)
    })
  },

  async remove(account: string, chatId: string, ids: string[]): Promise<void> {
    if (!ids.length) return
    await withDb(undefined, () =>
      db.chatArchive.bulkDelete(ids.map((id) => [account, chatId, id] as [string, string, string]))
    )
  },

  /** Записи по id (каких нет — пропускаются). */
  async get(account: string, chatId: string, ids: string[]): Promise<ChatArchiveRecord[]> {
    return withDb<ChatArchiveRecord[]>([], async () => {
      const rows = await db.chatArchive.bulkGet(
        ids.map((id) => [account, chatId, id] as [string, string, string])
      )
      return rows.filter((r): r is ChatArchiveRecord => !!r)
    })
  },

  /** Id всех сохранённых сообщений чата. */
  async ids(account: string, chatId: string): Promise<string[]> {
    return withDb<string[]>([], async () => {
      const keys = await db.chatArchive
        .where('[account+chatId+id]')
        .between([account, chatId, MIN], [account, chatId, MAX])
        .primaryKeys()
      return keys.map((key) => key[2])
    })
  },

  /** Самые поздние `limit` сообщений раньше `before` (мс), по возрастанию времени. */
  async before(
    account: string,
    chatId: string,
    before: number,
    limit: number
  ): Promise<ChatArchiveRecord[]> {
    return withDb<ChatArchiveRecord[]>([], async () => {
      const rows = await db.chatArchive
        .where('[account+chatId+ts]')
        .between([account, chatId, MIN], [account, chatId, before], true, false)
        .reverse()
        .limit(limit)
        .toArray()
      return rows.reverse()
    })
  },

  /** Сообщения с `from` (мс) и позже, по возрастанию времени. */
  async since(account: string, chatId: string, from: number): Promise<ChatArchiveRecord[]> {
    return withDb<ChatArchiveRecord[]>([], () =>
      db.chatArchive
        .where('[account+chatId+ts]')
        .between([account, chatId, from], [account, chatId, MAX])
        .toArray()
    )
  },

  /** Время и id сообщений раньше `before` — без расшифровки, по возрастанию времени. */
  async keysBefore(
    account: string,
    chatId: string,
    before: number
  ): Promise<{ id: string; ts: number }[]> {
    return withDb<{ id: string; ts: number }[]>([], async () => {
      const out: { id: string; ts: number }[] = []
      await db.chatArchive
        .where('[account+chatId+ts]')
        .between([account, chatId, MIN], [account, chatId, before], true, false)
        .eachKey((key, cursor) => {
          const primary = cursor.primaryKey as [string, string, string]
          out.push({ ts: (key as [string, string, number])[2], id: primary[2] })
        })
      return out
    })
  },

  /** Сколько сохранено в каждом чате аккаунта и за какое время — по ключам, без расшифровки. */
  async stats(account: string): Promise<Record<string, ArchiveChatStats>> {
    return withDb<Record<string, ArchiveChatStats>>({}, async () => {
      const out: Record<string, ArchiveChatStats> = {}
      await db.chatArchive
        .where('[account+chatId+ts]')
        .between([account, MIN, MIN], [account, MAX, MAX])
        .eachKey((key) => {
          const [, chatId, ts] = key as [string, string, number]
          const row = out[chatId]
          if (!row) out[chatId] = { count: 1, firstTs: ts, lastTs: ts }
          else {
            row.count += 1
            if (ts < row.firstTs) row.firstTs = ts
            if (ts > row.lastTs) row.lastTs = ts
          }
        })
      return out
    })
  },

  /** Самое раннее сохранённое сообщение чата. */
  async first(account: string, chatId: string): Promise<ChatArchiveRecord | null> {
    return withDb<ChatArchiveRecord | null>(
      null,
      async () => (await chatRange(account, chatId).first()) ?? null
    )
  },

  /** Самое позднее сообщение чата. */
  async last(account: string, chatId: string): Promise<ChatArchiveRecord | null> {
    return withDb<ChatArchiveRecord | null>(
      null,
      async () => (await chatRange(account, chatId).last()) ?? null
    )
  },

  async getChat(account: string, chatId: string): Promise<ChatArchiveChat | null> {
    return withDb<ChatArchiveChat | null>(
      null,
      async () => (await db.chatArchiveChats.get([account, chatId])) ?? null
    )
  },

  async putChat(chat: ChatArchiveChat): Promise<void> {
    await withDb(undefined, async () => {
      await db.chatArchiveChats.put(chat)
    })
  },

  async chats(account: string): Promise<ChatArchiveChat[]> {
    return withDb<ChatArchiveChat[]>([], () =>
      db.chatArchiveChats.where('account').equals(account).toArray()
    )
  },

  /** Стереть копию одного чата. */
  async removeChat(account: string, chatId: string): Promise<void> {
    await withDb(undefined, async () => {
      await db.transaction('rw', db.chatArchive, db.chatArchiveChats, async () => {
        await chatRange(account, chatId).delete()
        await db.chatArchiveChats.delete([account, chatId])
      })
    })
  },

  /** Стереть всю сохранённую переписку аккаунта. */
  async removeAccount(account: string): Promise<void> {
    await withDb(undefined, async () => {
      await db.transaction('rw', db.chatArchive, db.chatArchiveChats, async () => {
        await db.chatArchive.where('account').equals(account).delete()
        await db.chatArchiveChats.where('account').equals(account).delete()
      })
    })
  },
}
