import { db } from '../database'
import { setTimestamps } from '../utils'
import type { VideoData } from '../types'

/**
 * API для работы с видео
 */
export const videoAPI = {
  /**
   * Сохранить или обновить видео
   */
  async save(video: VideoData): Promise<string> {
    const withTimestamps = setTimestamps(video, !video.createdAt)
    return await db.videos.put(withTimestamps)
  },

  /**
   * Получить видео по ID
   */
  async get(id: string): Promise<VideoData | undefined> {
    return await db.videos.get(id)
  },

  /**
   * Получить все видео
   */
  async getAll(): Promise<VideoData[]> {
    return await db.videos.toArray()
  },

  /**
   * Удалить видео
   */
  async delete(id: string): Promise<void> {
    await db.videos.delete(id)
  },

  /**
   * Поиск видео по URL
   */
  async findByUrl(url: string): Promise<VideoData | undefined> {
    return await db.videos.where('url').equals(url).first()
  },

  /**
   * Получить видео, отсортированные по дате создания
   */
  async getRecent(limit?: number): Promise<VideoData[]> {
    let query = db.videos.orderBy('createdAt').reverse()
    if (limit) {
      query = query.limit(limit)
    }
    return await query.toArray()
  }
}
