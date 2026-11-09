import { db, withDb } from '../database'
import type { AdaptedPost } from '@/types/adapted-post'

/**
 * Сохранённая лента — первая страница каждой ленты на устройстве.
 *
 * Без сети запуск показывал пустую ленту: посты живут только в памяти, а
 * справка и скачанное открывались. Теперь первая страница последних лент
 * (вкладка, языки, фильтры, аккаунт) лежит в базе, и без связи лента
 * показывает её с пометкой, когда она сохранена (use-infinite-feed).
 *
 * Хранится в таблице настроек: строка на ленту и строка-оглавление с
 * временем сохранения — по нему вытесняются самые старые. Ленты аккаунта
 * стираются при его удалении и выходе, все — в «Очистить кэш».
 */

export const FEED_SNAPSHOT_PREFIX = 'feed-snapshot:'
const INDEX_KEY = `${FEED_SNAPSHOT_PREFIX}index`
/** Сколько лент помнить: вкладки, на которые заходят чаще всего. */
export const FEED_SNAPSHOT_MAX = 6
/** Постов в сохранённой ленте — первая страница. */
export const FEED_SNAPSHOT_POSTS = 20

interface IndexEntry {
  id: string
  account: string
  savedAt: number
}

interface SnapshotRow {
  /** Полный ключ ленты: id — его хэш, совпадение проверяем при чтении. */
  key: string
  account: string
  savedAt: number
  posts: AdaptedPost[]
}

export interface FeedSnapshot {
  /** Когда сохранена, мс. */
  savedAt: number
  posts: AdaptedPost[]
}

/** FNV-1a: короткий id строки вместо ключа ленты в сотни символов. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

const rowId = (key: string): string => FEED_SNAPSHOT_PREFIX + hash(key)

function put(key: string, value: unknown): Promise<string> {
  const now = Date.now()
  return db.settings.put({ key, value, createdAt: now, updatedAt: now })
}

async function readIndex(): Promise<IndexEntry[]> {
  const value = (await db.settings.get(INDEX_KEY))?.value
  return Array.isArray(value) ? (value as IndexEntry[]) : []
}

export const feedSnapshotAPI = {
  /** Сохранить первую страницу ленты `key`; старые ленты сверх FEED_SNAPSHOT_MAX уходят. */
  async save(account: string, key: string, posts: readonly AdaptedPost[]): Promise<void> {
    if (!posts.length) return
    // Копия без реактивных обёрток: Proxy в IndexedDB не кладётся.
    const plain = JSON.parse(JSON.stringify(posts.slice(0, FEED_SNAPSHOT_POSTS))) as AdaptedPost[]
    const id = rowId(key)
    const savedAt = Date.now()
    await withDb(undefined, () =>
      db.transaction('rw', db.settings, async () => {
        const index = [{ id, account, savedAt }, ...(await readIndex()).filter((e) => e.id !== id)]
        const dropped = index.slice(FEED_SNAPSHOT_MAX).map((e) => e.id)
        if (dropped.length) await db.settings.bulkDelete(dropped)
        await put(INDEX_KEY, index.slice(0, FEED_SNAPSHOT_MAX))
        const row: SnapshotRow = { key, account, savedAt, posts: plain }
        await put(id, row)
      })
    )
  },

  /** Сохранённая лента `key`; null — её нет. */
  async load(key: string): Promise<FeedSnapshot | null> {
    return withDb<FeedSnapshot | null>(null, async () => {
      const row = (await db.settings.get(rowId(key)))?.value as SnapshotRow | undefined
      if (!row || row.key !== key || !Array.isArray(row.posts) || !row.posts.length) return null
      return { savedAt: row.savedAt, posts: row.posts }
    })
  },

  /** Стереть ленты аккаунта (его удалили с устройства). */
  async forgetAccount(account: string): Promise<void> {
    await withDb(undefined, () =>
      db.transaction('rw', db.settings, async () => {
        const index = await readIndex()
        const gone = index.filter((e) => e.account === account).map((e) => e.id)
        if (!gone.length) return
        await db.settings.bulkDelete(gone)
        await put(
          INDEX_KEY,
          index.filter((e) => e.account !== account)
        )
      })
    )
  },

  /** Сколько лент сохранено. */
  async count(): Promise<number> {
    return withDb(0, async () => {
      const keys = await db.settings.where('key').startsWith(FEED_SNAPSHOT_PREFIX).primaryKeys()
      return keys.filter((k) => k !== INDEX_KEY).length
    })
  },

  /** Стереть все сохранённые ленты; вернуть, сколько их было. */
  async clear(): Promise<number> {
    const removed = await feedSnapshotAPI.count()
    await withDb(undefined, () =>
      db.settings.where('key').startsWith(FEED_SNAPSHOT_PREFIX).delete()
    )
    return removed
  },
}
