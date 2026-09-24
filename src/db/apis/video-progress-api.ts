import { db, withDb } from '../database'
import type { VideoProgress } from '../types'

/** Сколько позиций храним: список ограничен, чтобы база не пухла годами. */
const MAX_ENTRIES = 300

/**
 * API позиций просмотра видео. Плеер продолжает ролик с того места, где его
 * прервали. Недоступная база не должна ронять плеер (S61) — всё через withDb.
 */
export const videoProgressAPI = {
  /** Сохранённая позиция или null. */
  async get(id: string): Promise<VideoProgress | null> {
    if (!id) return null
    return withDb<VideoProgress | null>(null, async () => (await db.videoProgress.get(id)) ?? null)
  },

  /** Запомнить позицию. Старые записи подрезаются, чтобы таблица не росла. */
  async save(id: string, position: number, duration: number): Promise<void> {
    if (!id) return
    await withDb(undefined, async () => {
      await db.videoProgress.put({ id, position, duration, updatedAt: Date.now() })
      const count = await db.videoProgress.count()
      if (count <= MAX_ENTRIES) return
      const stale = await db.videoProgress
        .orderBy('updatedAt')
        .limit(count - MAX_ENTRIES)
        .primaryKeys()
      await db.videoProgress.bulkDelete(stale)
    })
  },

  /** Забыть позицию (ролик досмотрен до конца). */
  async clear(id: string): Promise<void> {
    if (!id) return
    await withDb(undefined, () => db.videoProgress.delete(id))
  },
}
