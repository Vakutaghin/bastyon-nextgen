import Dexie, { Table } from 'dexie'
import type { VideoData, TranscodedVideo, PendingPostRating, AppSettings, FavoritePost, StoredNotification, DecryptedMessage } from './types'

/**
 * Класс базы данных с использованием Dexie
 */
export class AppDatabase extends Dexie {
  // Определяем таблицы с типами
  transcodedVideos!: Table<TranscodedVideo, string>
  postRatingsPending!: Table<PendingPostRating, number>
  settings!: Table<AppSettings, string>
  favorites!: Table<FavoritePost, string>
  notifications!: Table<StoredNotification, [string, string]>
  decryptedMessages!: Table<DecryptedMessage, [string, string]>

  constructor() {
    super('BastyonDB')

    this.version(1).stores({
      transcodedVideos: 'id, originalFileName, resolution, createdAt',
      postRatingsPending: '++id, shareId, userAddress, expiresAt, status',
      settings: 'key, createdAt',
      favorites: 'id, addedAt',
      notifications: '[address+id], address, nblock',
    })

    // v2: добавлен персистентный кэш расшифрованных сообщений мессенджера.
    // Ключ — (userId, eventId). PBKDF2 10000 итераций + EAA secp256k1 — очень дорогая
    // операция, имеет смысл переживать перезагрузку, чтобы открытие списка диалогов
    // и истории чатов было моментальным.
    this.version(2).stores({
      transcodedVideos: 'id, originalFileName, resolution, createdAt',
      postRatingsPending: '++id, shareId, userAddress, expiresAt, status',
      settings: 'key, createdAt',
      favorites: 'id, addedAt',
      notifications: '[address+id], address, nblock',
      decryptedMessages: '[userId+eventId], userId, createdAt',
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
