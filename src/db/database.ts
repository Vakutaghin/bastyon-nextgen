import Dexie, { Table } from 'dexie'
import type { VideoData, ContentCache, TranscodedVideo, PendingPostRating, AppSettings, FavoritePost } from './types'

/**
 * Класс базы данных с использованием Dexie
 */
export class AppDatabase extends Dexie {
  // Определяем таблицы с типами
  videos!: Table<VideoData, string>
  contentCache!: Table<ContentCache, string>
  transcodedVideos!: Table<TranscodedVideo, string>
  postRatingsPending!: Table<PendingPostRating, number>
  settings!: Table<AppSettings, string>
  favorites!: Table<FavoritePost, string>

  constructor() {
    super('BastyonDB')

    // Определяем схему базы данных
    // Версия 1: базовые таблицы
    this.version(1).stores({
      videos: 'id, url, createdAt',
      contentCache: 'key, expiresAt, createdAt'
    })

    // Версия 2: добавляем таблицу для транскодированных видео
    // Dexie автоматически мигрирует базу данных при обновлении схемы
    this.version(2).stores({
      videos: 'id, url, createdAt',
      contentCache: 'key, expiresAt, createdAt',
      transcodedVideos: 'id, originalFileName, resolution, createdAt' // новая таблица
    })

    this.version(3).stores({
      videos: 'id, url, createdAt',
      contentCache: 'key, expiresAt, createdAt',
      transcodedVideos: 'id, originalFileName, resolution, createdAt',
      postRatingsPending: '++id, shareId, userAddress, expiresAt, status'
    })

    this.version(4).stores({
      videos: 'id, url, createdAt',
      contentCache: 'key, expiresAt, createdAt',
      transcodedVideos: 'id, originalFileName, resolution, createdAt',
      postRatingsPending: '++id, shareId, userAddress, expiresAt, status',
      settings: 'key, createdAt'
    })
    
    // Версия 5: добавляем таблицу избранных постов
    this.version(5).stores({
      videos: 'id, url, createdAt',
      contentCache: 'key, expiresAt, createdAt',
      transcodedVideos: 'id, originalFileName, resolution, createdAt',
      postRatingsPending: '++id, shareId, userAddress, expiresAt, status',
      settings: 'key, createdAt',
      favorites: 'id, addedAt'
    })
  }
}

/**
 * Экспортируем singleton экземпляр базы данных
 */
export const db = new AppDatabase()

/**
 * Инициализация базы данных
 * Вызывается при старте приложения
 */
export async function initDatabase(): Promise<void> {
  try {
    // Открываем базу данных
    await db.open()
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error)
    throw error
  }
}

/**
 * Очистка базы данных (для тестирования или сброса)
 */
export async function clearDatabase(): Promise<void> {
  try {
    await db.delete()
    await initDatabase()
    console.info('Database cleared and reinitialized')
  } catch (error) {
    console.error('Failed to clear database:', error)
    throw error
  }
}
