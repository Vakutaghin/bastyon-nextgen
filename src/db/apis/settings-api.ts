import { db } from '../database'
import { setTimestamps } from '../utils'
import type { AppSettings } from '../types'

/**
 * API для работы с настройками приложения
 */
export const settingsAPI = {
  /**
   * Сохранить настройку
   */
  async set(key: string, value: any): Promise<string> {
    const setting: AppSettings = {
      key,
      value,
      ...setTimestamps({} as AppSettings, true)
    }
    return await db.settings.put(setting)
  },

  /**
   * Получить настройку
   */
  async get(key: string): Promise<any | undefined> {
    const item = await db.settings.get(key)
    return item?.value
  }
}
