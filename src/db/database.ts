import Dexie, { Table } from 'dexie'
import type {
  AppSettings,
  DecryptedMessage,
  FavoritePost,
  PendingPostRating,
  StoredNotification,
  TranscodedVideo,
  VideoProgress,
} from './types'

/**
 * Класс базы данных с использованием Dexie
 */
export class AppDatabase extends Dexie {
  // Определяем таблицы с типами
  transcodedVideos!: Table<TranscodedVideo, string>
  postRatingsPending!: Table<PendingPostRating, number>
  settings!: Table<AppSettings, string>
  favorites!: Table<FavoritePost, [string, string]>
  notifications!: Table<StoredNotification, [string, string]>
  decryptedMessages!: Table<DecryptedMessage, [string, string]>
  videoProgress!: Table<VideoProgress, string>

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

    // v3: избранное привязано к аккаунту (N10/Р5). Старые записи получают
    // address '' и при первом обращении аккаунта переезжают к нему
    // (favoritesAPI.adoptLegacy) — «миграция на текущий адрес».
    this.version(3)
      .stores({
        transcodedVideos: 'id, originalFileName, resolution, createdAt',
        postRatingsPending: '++id, shareId, userAddress, expiresAt, status',
        settings: 'key, createdAt',
        favorites: '[address+id], address, addedAt',
        notifications: '[address+id], address, nblock',
        decryptedMessages: '[userId+eventId], userId, createdAt',
      })
      .upgrade((tx) =>
        tx
          .table('favorites')
          .toCollection()
          .modify((row: { address?: string }) => {
            if (typeof row.address !== 'string') row.address = ''
          })
      )

    // v4: позиция просмотра видео. Новая таблица, старые данные не трогаем —
    // Dexie доводит схему сам, апгрейд не нужен.
    this.version(4).stores({
      transcodedVideos: 'id, originalFileName, resolution, createdAt',
      postRatingsPending: '++id, shareId, userAddress, expiresAt, status',
      settings: 'key, createdAt',
      favorites: '[address+id], address, addedAt',
      notifications: '[address+id], address, nblock',
      decryptedMessages: '[userId+eventId], userId, createdAt',
      videoProgress: 'id, updatedAt',
    })
  }
}

/**
 * Экспортируем singleton экземпляр базы данных
 */
export const db = new AppDatabase()

/**
 * Локальная база недоступна (S61).
 *
 * `open()` падает в реальных ситуациях: `VersionError` после отката билда
 * (схема новее кода), `InvalidStateError` в приватном окне Firefox, закрытая
 * пользователем база. Приложение при этом монтируется и работает без кэша —
 * но каждый вызов к Dexie уходил в unhandled rejection, а глобальный
 * обработчик показывал «Что-то пошло не так» каждые 30 секунд (поллер
 * уведомлений) и на каждую карточку поста (избранное).
 */
let dbUnavailableError: Error | null = null

/** `true`, если локальная база не открылась. */
export function isDbUnavailable(): boolean {
  return dbUnavailableError !== null
}

/** Помечает базу недоступной. Идемпотентно (первая причина важнее). */
export function markDbUnavailable(error: unknown): void {
  if (dbUnavailableError) return
  dbUnavailableError = error instanceof Error ? error : new Error(String(error))
  console.warn('[db] local database is unavailable:', dbUnavailableError)
}

/** Только для тестов: вернуть базу в «доступное» состояние. */
export function resetDbAvailabilityForTests(): void {
  dbUnavailableError = null
}

/**
 * Best-effort обращение к базе: если база не открылась (или упала на этом
 * вызове) — возвращаем fallback вместо исключения. Кэш — не критичный путь,
 * приложение обязано работать и без него (S61).
 */
export async function withDb<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  if (isDbUnavailable()) return fallback
  try {
    return await run()
  } catch (error) {
    // Отличаем «база сломана» от обычной ошибки запроса: первое выключает кэш
    // целиком, второе просто отдаёт fallback.
    if (isFatalDbError(error)) markDbUnavailable(error)
    else console.warn('[db] request failed:', error)
    return fallback
  }
}

/** Ошибки, после которых обращаться к базе бессмысленно. */
const FATAL_DB_ERROR_NAMES = new Set([
  'VersionError',
  'InvalidStateError',
  'DatabaseClosedError',
  'MissingAPIError',
  'UnknownError',
  'QuotaExceededError',
])

export function isFatalDbError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  return typeof name === 'string' && FATAL_DB_ERROR_NAMES.has(name)
}

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
    // Дальше работаем без локального кэша, а не заваливаем пользователя
    // повторяющимися тостами об ошибке (S61).
    markDbUnavailable(error)
    throw error
  }
}
