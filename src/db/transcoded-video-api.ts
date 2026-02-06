import { db } from './database'
import { setTimestamps } from './utils'
import type { TranscodedVideo } from './types'

/**
 * API для работы с транскодированными видео
 */
export const transcodedVideoAPI = {
  /**
   * Сохранить транскодированное видео
   */
  async save(video: Omit<TranscodedVideo, 'createdAt' | 'updatedAt'>): Promise<string> {
    const withTimestamps = setTimestamps(video as TranscodedVideo, true)
    return await db.transcodedVideos.put(withTimestamps)
  },

  /**
   * Получить транскодированное видео по ID
   */
  async get(id: string): Promise<TranscodedVideo | undefined> {
    return await db.transcodedVideos.get(id)
  },

  /**
   * Получить все транскодированные видео
   */
  async getAll(): Promise<TranscodedVideo[]> {
    return await db.transcodedVideos.toArray()
  },

  /**
   * Получить транскодированные видео, отсортированные по дате создания (новые первыми)
   */
  async getRecent(limit?: number): Promise<TranscodedVideo[]> {
    let query = db.transcodedVideos.orderBy('createdAt').reverse()
    if (limit) {
      query = query.limit(limit)
    }
    return await query.toArray()
  },

  /**
   * Удалить транскодированное видео
   */
  async delete(id: string): Promise<void> {
    await db.transcodedVideos.delete(id)
  },

  /**
   * Получить Blob для воспроизведения видео
   */
  async getVideoBlob(id: string): Promise<Blob | null> {
    const video = await db.transcodedVideos.get(id)
    return video?.transcodedBlob || null
  },

  /**
   * Создать Object URL для воспроизведения видео
   * ВАЖНО: После использования URL нужно вызвать URL.revokeObjectURL() для освобождения памяти
   */
  async getVideoUrl(id: string): Promise<string | null> {
    const blob = await this.getVideoBlob(id)
    return blob ? URL.createObjectURL(blob) : null
  },

  /**
   * Получить количество сохраненных видео
   */
  async count(): Promise<number> {
    return await db.transcodedVideos.count()
  },

  /**
   * Очистить все транскодированные видео
   */
  async clearAll(): Promise<void> {
    await db.transcodedVideos.clear()
  },

  /**
   * Получить общий размер всех транскодированных видео в байтах
   */
  async getTotalSize(): Promise<number> {
    const videos = await db.transcodedVideos.toArray()
    return videos.reduce((total, video) => total + video.transcodedBlob.size, 0)
  }
}
