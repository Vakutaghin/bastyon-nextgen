import { db, withDb } from '../database'
import { setTimestamps } from '../utils'
import type { AppSettings } from '../types'

/**
 * API для работы с настройками приложения
 */
export const settingsAPI = {
  /**
   * Сохранить настройку
   */
  async set(key: string, value: unknown): Promise<string> {
    const setting: AppSettings = {
      key,
      value,
      ...setTimestamps({} as AppSettings, true),
    }
    // Настройки переживут отсутствие базы: вызов не должен бросать (S61).
    return await withDb(key, () => db.settings.put(setting))
  },

  /**
   * Получить настройку
   */
  async get(key: string): Promise<unknown> {
    return withDb<unknown>(undefined, async () => (await db.settings.get(key))?.value)
  },
}
