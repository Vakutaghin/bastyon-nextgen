import { db, withDb } from '../database'

/**
 * Превью аватарок на устройстве (services/avatar-thumbs): строка на картинку в
 * таблице настроек, ключ — префикс и хэш адреса картинки, время записи — когда
 * превью последний раз сохраняли или освежали. Сверх AVATAR_THUMBS_MAX
 * вытесняются самые давние. Стирается в «Очистить сохранённые данные», при
 * выходе и удалении аккаунта.
 */

export const AVATAR_THUMB_PREFIX = 'avatar-thumb:'
/** Сколько превью помнить: около 5 КБ каждое — до 4 МБ. */
export const AVATAR_THUMBS_MAX = 800

export interface AvatarThumbRow {
  /** Адрес картинки: ключ — его хэш, совпадение проверяем при чтении. */
  url: string
  /** Превью, data URL. */
  data: string
  /** Когда записано, мс. */
  savedAt: number
}

/** FNV-1a: короткий ключ вместо адреса картинки в сотню символов. */
export function thumbKey(url: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return AVATAR_THUMB_PREFIX + (h >>> 0).toString(36) + url.length.toString(36)
}

export const avatarThumbsAPI = {
  /**
   * Ключи сохранённых превью; самые давние сверх AVATAR_THUMBS_MAX стираются.
   * `null` — база недоступна.
   */
  async keys(): Promise<Set<string> | null> {
    return withDb<Set<string> | null>(null, async () => {
      // Порядок по времени записи — без чтения самих превью.
      const ordered = (await db.settings.orderBy('createdAt').primaryKeys()).filter((key) =>
        key.startsWith(AVATAR_THUMB_PREFIX)
      )
      const excess = ordered.length - AVATAR_THUMBS_MAX
      if (excess > 0) await db.settings.bulkDelete(ordered.slice(0, excess))
      return new Set(excess > 0 ? ordered.slice(excess) : ordered)
    })
  },

  /** Превью по ключам; чужие адреса (совпал хэш) не отдаются. */
  async get(
    entries: ReadonlyArray<readonly [key: string, url: string]>
  ): Promise<AvatarThumbRow[]> {
    if (!entries.length) return []
    return withDb<AvatarThumbRow[]>([], async () => {
      const rows = await db.settings.bulkGet(entries.map(([key]) => key))
      const out: AvatarThumbRow[] = []
      rows.forEach((row, i) => {
        const value = row?.value as Partial<AvatarThumbRow> | undefined
        if (value?.url !== entries[i]![1] || typeof value.data !== 'string') return
        out.push({ url: value.url, data: value.data, savedAt: row?.createdAt ?? 0 })
      })
      return out
    })
  },

  /** Записать превью; время записи — сейчас. */
  async save(thumbs: ReadonlyArray<{ url: string; data: string }>): Promise<void> {
    if (!thumbs.length) return
    const now = Date.now()
    const rows = thumbs.map(({ url, data }) => ({
      key: thumbKey(url),
      value: { url, data },
      createdAt: now,
      updatedAt: now,
    }))
    await withDb(undefined, () => db.settings.bulkPut(rows).then(() => undefined))
  },

  /** Сколько превью сохранено. */
  async count(): Promise<number> {
    return withDb(0, () => db.settings.where('key').startsWith(AVATAR_THUMB_PREFIX).count())
  },

  /** Стереть все превью; вернуть, сколько их было. */
  async clear(): Promise<number> {
    return withDb(0, () => db.settings.where('key').startsWith(AVATAR_THUMB_PREFIX).delete())
  },
}
