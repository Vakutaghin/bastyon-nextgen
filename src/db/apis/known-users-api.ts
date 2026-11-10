import { db, withDb } from '../database'

/**
 * Имена и аватары пользователей на устройстве — чтобы подписи после
 * перезапуска выходили с ником сразу, в том числе без сети (user-names-saved).
 *
 * Хранится в таблице настроек, строка на пользователя: ключ — префикс и
 * адрес, время записи — когда нода о нём последний раз отвечала. Сверх
 * KNOWN_USERS_MAX вытесняются те, кого давно не видели. Стирается в «Очистить
 * сохранённые данные», при выходе и удалении аккаунта.
 */

export const KNOWN_USER_PREFIX = 'known-user:'
/** Сколько помнить: около 150 байт на человека — до полумегабайта. */
export const KNOWN_USERS_MAX = 3000

/** Что хранится о пользователе. */
export interface SavedUserValue {
  name?: string
  avatar?: string | null
  deleted?: boolean
  badges?: string[]
}

/** Простая копия без реактивных обёрток: Proxy в IndexedDB не кладётся. */
function plain(user: SavedUserValue): SavedUserValue {
  if (user.deleted) return { deleted: true }
  const out: SavedUserValue = { name: user.name, avatar: user.avatar ?? null }
  if (user.badges) out.badges = [...user.badges]
  return out
}

export const knownUsersAPI = {
  /** Все сохранённые, недавние первыми; самые давние сверх KNOWN_USERS_MAX стираются. */
  async load(): Promise<Array<[string, SavedUserValue]>> {
    return withDb<Array<[string, SavedUserValue]>>([], async () => {
      const rows = await db.settings.where('key').startsWith(KNOWN_USER_PREFIX).toArray()
      rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      const excess = rows.slice(KNOWN_USERS_MAX).map((row) => row.key)
      if (excess.length) await db.settings.bulkDelete(excess)
      return rows
        .slice(0, KNOWN_USERS_MAX)
        .map((row) => [row.key.slice(KNOWN_USER_PREFIX.length), row.value as SavedUserValue])
    })
  },

  /** Записать пользователей; время записи — сейчас. */
  async save(entries: Iterable<readonly [string, SavedUserValue]>): Promise<void> {
    const now = Date.now()
    const rows = [...entries]
      .filter(([address]) => !!address)
      .map(([address, user]) => ({
        key: KNOWN_USER_PREFIX + address,
        value: plain(user),
        createdAt: now,
        updatedAt: now,
      }))
    if (!rows.length) return
    await withDb(undefined, () => db.settings.bulkPut(rows).then(() => undefined))
  },

  /** Сколько пользователей сохранено. */
  async count(): Promise<number> {
    return withDb(0, () => db.settings.where('key').startsWith(KNOWN_USER_PREFIX).count())
  },

  /** Стереть всех; вернуть, сколько их было. */
  async clear(): Promise<number> {
    return withDb(0, () => db.settings.where('key').startsWith(KNOWN_USER_PREFIX).delete())
  },
}
