import { db } from '../database'
import { setTimestamps } from '../utils'
import type { TranscodedVideo } from '../types'

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
    try {
      // Проверяем, существует ли запись перед удалением
      const video = await db.transcodedVideos.get(id)
      if (!video) {
        console.warn(`Видео с ID ${id} не найдено в базе данных`)
        return
      }

      // Удаляем запись
      await db.transcodedVideos.delete(id)

      // Проверяем, что запись действительно удалена
      const deletedVideo = await db.transcodedVideos.get(id)
      if (deletedVideo) {
        throw new Error(`Не удалось удалить видео с ID ${id}`)
      }
    } catch (error) {
      console.error(`Ошибка при удалении видео с ID ${id}:`, error)
      throw error
    }
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
  },

  /**
   * Получить статистику хранилища
   */
  async getStorageStats(): Promise<{
    count: number
    totalSize: number
    totalSizeMB: number
    averageSize: number
    averageSizeMB: number
  }> {
    const videos = await db.transcodedVideos.toArray()
    const count = videos.length
    const totalSize = videos.reduce((total, video) => total + video.transcodedBlob.size, 0)
    const totalSizeMB = totalSize / (1024 * 1024)
    const averageSize = count > 0 ? totalSize / count : 0
    const averageSizeMB = averageSize / (1024 * 1024)

    return {
      count,
      totalSize,
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      averageSize,
      averageSizeMB: Math.round(averageSizeMB * 100) / 100
    }
  },

  /**
   * Удалить старые записи (старше указанного количества дней)
   * @param days Количество дней (по умолчанию 30)
   */
  async deleteOld(days: number = 30): Promise<number> {
    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000
    const oldVideos = await db.transcodedVideos
      .where('createdAt')
      .below(cutoffDate)
      .toArray()

    const ids = oldVideos.map(v => v.id)
    await db.transcodedVideos.bulkDelete(ids)
    return ids.length
  },

  /**
   * Удалить записи, превышающие лимит по количеству
   * Удаляет самые старые записи, оставляя только указанное количество
   * @param limit Максимальное количество записей для хранения
   */
  async enforceLimit(limit: number): Promise<number> {
    const allVideos = await db.transcodedVideos
      .orderBy('createdAt')
      .toArray()

    if (allVideos.length <= limit) {
      return 0
    }

    const toDelete = allVideos.slice(0, allVideos.length - limit)
    const ids = toDelete.map(v => v.id)
    await db.transcodedVideos.bulkDelete(ids)
    return ids.length
  },

  /**
   * Удалить записи, превышающие лимит по размеру
   * Удаляет самые старые записи, пока общий размер не станет меньше лимита
   * @param maxSizeMB Максимальный размер в мегабайтах
   */
  async enforceSizeLimit(maxSizeMB: number): Promise<number> {
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    const allVideos = await db.transcodedVideos
      .orderBy('createdAt')
      .toArray()

    let totalSize = allVideos.reduce((total, video) => total + video.transcodedBlob.size, 0)

    if (totalSize <= maxSizeBytes) {
      return 0
    }

    const toDelete: string[] = []
    for (const video of allVideos) {
      if (totalSize <= maxSizeBytes) {
        break
      }
      toDelete.push(video.id)
      totalSize -= video.transcodedBlob.size
    }

    if (toDelete.length > 0) {
      await db.transcodedVideos.bulkDelete(toDelete)
    }

    return toDelete.length
  },

  /**
   * Очистить просроченные записи и применить лимиты
   * @param options Опции очистки
   */
  async cleanup(options: {
    maxAgeDays?: number
    maxCount?: number
    maxSizeMB?: number
  } = {}): Promise<{
    deletedByAge: number
    deletedByCount: number
    deletedBySize: number
    totalDeleted: number
  }> {
    let deletedByAge = 0
    let deletedByCount = 0
    let deletedBySize = 0

    // Удаляем старые записи
    if (options.maxAgeDays !== undefined) {
      deletedByAge = await this.deleteOld(options.maxAgeDays)
    }

    // Применяем лимит по количеству
    if (options.maxCount !== undefined) {
      deletedByCount = await this.enforceLimit(options.maxCount)
    }

    // Применяем лимит по размеру
    if (options.maxSizeMB !== undefined) {
      deletedBySize = await this.enforceSizeLimit(options.maxSizeMB)
    }

    return {
      deletedByAge,
      deletedByCount,
      deletedBySize,
      totalDeleted: deletedByAge + deletedByCount + deletedBySize
    }
  },

  /**
   * Получить видео по имени файла
   */
  async findByFileName(fileName: string): Promise<TranscodedVideo | undefined> {
    return await db.transcodedVideos
      .where('originalFileName')
      .equals(fileName)
      .first()
  },

  /**
   * Получить видео по разрешению
   */
  async findByResolution(resolution: string): Promise<TranscodedVideo[]> {
    return await db.transcodedVideos
      .where('resolution')
      .equals(resolution)
      .toArray()
  },

  /**
   * Проверить, существует ли видео с таким ID
   */
  async exists(id: string): Promise<boolean> {
    const video = await db.transcodedVideos.get(id)
    return video !== undefined
  }
}
