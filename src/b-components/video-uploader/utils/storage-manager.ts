import { transcodedVideoAPI } from '@/db/apis/transcoded-video-api'

/**
 * Константы для управления хранилищем
 */
export const STORAGE_LIMITS = {
  /** Максимальный размер хранилища в мегабайтах (по умолчанию 500 MB) */
  MAX_SIZE_MB: 500,
  /** Максимальное количество видео (по умолчанию 50) */
  MAX_COUNT: 50,
  /** Максимальный возраст записи в днях (по умолчанию 30) */
  MAX_AGE_DAYS: 30
} as const

/**
 * Менеджер хранилища для транскодированных видео
 * Управляет квотой, очисткой и оптимизацией хранилища
 */
export class StorageManager {
  /**
   * Получить статистику хранилища
   */
  async getStats() {
    return await transcodedVideoAPI.getStorageStats()
  }

  /**
   * Проверить, нужно ли очистить хранилище
   */
  async needsCleanup(): Promise<boolean> {
    const stats = await this.getStats()
    return (
      stats.count > STORAGE_LIMITS.MAX_COUNT ||
      stats.totalSizeMB > STORAGE_LIMITS.MAX_SIZE_MB
    )
  }

  /**
   * Выполнить автоматическую очистку хранилища
   * Применяет все лимиты
   */
  async autoCleanup(): Promise<{
    deletedByAge: number
    deletedByCount: number
    deletedBySize: number
    totalDeleted: number
  }> {
    return await transcodedVideoAPI.cleanup({
      maxAgeDays: STORAGE_LIMITS.MAX_AGE_DAYS,
      maxCount: STORAGE_LIMITS.MAX_COUNT,
      maxSizeMB: STORAGE_LIMITS.MAX_SIZE_MB
    })
  }

  /**
   * Получить информацию о доступном месте
   */
  async getAvailableSpace(): Promise<{
    usedMB: number
    availableMB: number
    usedPercent: number
    count: number
    maxCount: number
    countPercent: number
  }> {
    const stats = await this.getStats()
    const usedMB = stats.totalSizeMB
    const availableMB = Math.max(0, STORAGE_LIMITS.MAX_SIZE_MB - usedMB)
    const usedPercent = (usedMB / STORAGE_LIMITS.MAX_SIZE_MB) * 100
    const countPercent = (stats.count / STORAGE_LIMITS.MAX_COUNT) * 100

    return {
      usedMB: Math.round(usedMB * 100) / 100,
      availableMB: Math.round(availableMB * 100) / 100,
      usedPercent: Math.round(usedPercent * 100) / 100,
      count: stats.count,
      maxCount: STORAGE_LIMITS.MAX_COUNT,
      countPercent: Math.round(countPercent * 100) / 100
    }
  }

  /**
   * Проверить, можно ли сохранить новое видео заданного размера
   */
  async canSave(sizeMB: number): Promise<{
    canSave: boolean
    reason?: string
    needsCleanup: boolean
  }> {
    const stats = await this.getStats()
    const needsCleanup = await this.needsCleanup()

    // Проверяем лимит по количеству
    if (stats.count >= STORAGE_LIMITS.MAX_COUNT) {
      return {
        canSave: false,
        reason: `Maximum count limit reached (${STORAGE_LIMITS.MAX_COUNT})`,
        needsCleanup
      }
    }

    // Проверяем лимит по размеру
    const newTotalSize = stats.totalSizeMB + sizeMB
    if (newTotalSize > STORAGE_LIMITS.MAX_SIZE_MB) {
      return {
        canSave: false,
        reason: `Maximum size limit would be exceeded (${STORAGE_LIMITS.MAX_SIZE_MB} MB)`,
        needsCleanup
      }
    }

    return {
      canSave: true,
      needsCleanup
    }
  }

  /**
   * Сохранить видео с автоматической очисткой при необходимости
   */
  async saveWithCleanup(
    video: Parameters<typeof transcodedVideoAPI.save>[0],
    sizeMB: number
  ): Promise<string> {
    const canSaveResult = await this.canSave(sizeMB)

    if (!canSaveResult.canSave) {
      // Пытаемся очистить хранилище
      await this.autoCleanup()

      // Проверяем снова
      const canSaveAfterCleanup = await this.canSave(sizeMB)
      if (!canSaveAfterCleanup.canSave) {
        throw new Error(
          `Cannot save video: ${canSaveAfterCleanup.reason || 'Storage limit reached'}`
        )
      }
    }

    return await transcodedVideoAPI.save(video)
  }
}

/**
 * Singleton экземпляр менеджера хранилища
 */
export const storageManager = new StorageManager()
