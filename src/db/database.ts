import Dexie, { Table } from 'dexie'
import type {
  AppSettings,
  ChatArchiveChat,
  ChatArchiveRecord,
  DecryptedMessage,
  FavoritePost,
  MeshDialogRecord,
  MeshMessageRecord,
  PendingPostRating,
  StoredNotification,
  VideoProgress,
} from './types'

/**
 * Класс базы данных с использованием Dexie
 */
export class AppDatabase extends Dexie {
  // Определяем таблицы с типами
  postRatingsPending!: Table<PendingPostRating, number>
  settings!: Table<AppSettings, string>
  favorites!: Table<FavoritePost, [string, string]>
  notifications!: Table<StoredNotification, [string, string]>
  decryptedMessages!: Table<DecryptedMessage, [string, string]>
  videoProgress!: Table<VideoProgress, string>
  meshDialogs!: Table<MeshDialogRecord, string>
  meshMessages!: Table<MeshMessageRecord, string>
  chatArchive!: Table<ChatArchiveRecord, [string, string, string]>
  chatArchiveChats!: Table<ChatArchiveChat, [string, string]>

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

    // v5: переписка в mesh-сетях (src/mesh). Радио историю не хранит, поэтому
    // она здесь. `&dedupKey` — повтор ЛС (радио шлёт копию, пока нет ACK) не
    // станет второй записью.
    this.version(5).stores({
      transcodedVideos: 'id, originalFileName, resolution, createdAt',
      postRatingsPending: '++id, shareId, userAddress, expiresAt, status',
      settings: 'key, createdAt',
      favorites: '[address+id], address, addedAt',
      notifications: '[address+id], address, nblock',
      decryptedMessages: '[userId+eventId], userId, createdAt',
      videoProgress: 'id, updatedAt',
      meshDialogs: 'id, account',
      meshMessages: 'id, &dedupKey, [dialogId+ts], account',
    })

    // v6: сжатые копии видео больше не храним — загруженный ролик уже на
    // сервере, а «Повторить» берёт сжатый файл из задачи. Таблица уходит вместе
    // с копиями: у кого-то это до 500 МБ.
    this.version(6).stores({
      transcodedVideos: null,
      postRatingsPending: '++id, shareId, userAddress, expiresAt, status',
      settings: 'key, createdAt',
      favorites: '[address+id], address, addedAt',
      notifications: '[address+id], address, nblock',
      decryptedMessages: '[userId+eventId], userId, createdAt',
      videoProgress: 'id, updatedAt',
      meshDialogs: 'id, account',
      meshMessages: 'id, &dedupKey, [dialogId+ts], account',
    })

    // v7: переписка, сохранённая на устройстве (сервер чатов стирает её через
    // три месяца). Время и id событий — открыто, как их видит и сервер; само
    // сообщение — шифротекстом (messenger/lib/archive-crypto).
    this.version(7).stores({
      postRatingsPending: '++id, shareId, userAddress, expiresAt, status',
      settings: 'key, createdAt',
      favorites: '[address+id], address, addedAt',
      notifications: '[address+id], address, nblock',
      decryptedMessages: '[userId+eventId], userId, createdAt',
      videoProgress: 'id, updatedAt',
      meshDialogs: 'id, account',
      meshMessages: 'id, &dedupKey, [dialogId+ts], account',
      chatArchive: '[account+chatId+id], [account+chatId+ts], account',
      chatArchiveChats: '[account+chatId], account',
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
  opening = null
  openSettled = false
}

/**
 * Best-effort обращение к базе: если база не открылась (или упала на этом
 * вызове) — возвращаем fallback вместо исключения. Кэш — не критичный путь,
 * приложение обязано работать и без него (S61).
 */
export async function withDb<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  // Пока база открывается (и, может быть, пересобирается), запрос ждёт:
  // Dexie между неудачным открытием и повторным отвечает DatabaseClosedError,
  // а она выключила бы кэш до перезапуска. Открытие закончилось — не ждём
  // вовсе: лишний await внутри транзакции Dexie её бы закрыл.
  if (opening && !openSettled) await opening.catch(() => {})
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

/**
 * Только ошибки Dexie: те же имена бросают и другие API — повторный
 * `MediaRecorder.stop()` (InvalidStateError), закрытая база Matrix, полный
 * localStorage. Раньше любая такая ошибка выключала кэш и показывала
 * «Локальное хранилище недоступно».
 */
export function isFatalDbError(error: unknown): boolean {
  return error instanceof Dexie.DexieError && FATAL_DB_ERROR_NAMES.has(error.name)
}

/** Ошибка пришла от нашей базы (Dexie оборачивает в свои классы всё, что бросает IndexedDB). */
export function isOwnDbError(error: unknown): boolean {
  return error instanceof Dexie.DexieError
}

/** Открытие при запуске (initDatabase): его ждут обращения через withDb. */
let opening: Promise<void> | null = null
let openSettled = false

/**
 * Инициализация базы данных
 * Вызывается при старте приложения
 */
export function initDatabase(): Promise<void> {
  opening ??= openDatabase()
    .catch((error: unknown) => {
      console.error('Failed to initialize IndexedDB:', error)
      // Дальше работаем без локального кэша, а не заваливаем пользователя
      // повторяющимися тостами об ошибке (S61).
      markDbUnavailable(error)
      throw error
    })
    .finally(() => {
      openSettled = true
    })
  return opening
}

async function openDatabase(): Promise<void> {
  const saved = await takeRowsIfKeysChanged()
  await db.open()
  if (saved) await restoreRows(saved)
}

/**
 * Первичный ключ таблицы на диске не тот, что в схеме: так у баз ранних
 * сборок — избранное с ключом `id` (v1–v2). Dexie ключ не меняет и бросает
 * UpgradeError, а неудачное обновление ещё и портит схему экземпляра `db`
 * (новая база потом создаётся по схеме упавшего шага). Пока код объявлял
 * версию ниже записанной на диске, Dexie открывала такую базу как есть; v7
 * (0.18.0) потребовала настоящего обновления, и база перестала открываться —
 * «Локальное хранилище недоступно», «Что нового» на каждом запуске.
 *
 * Поэтому проверяем до Dexie: строки таблиц текущей схемы забираем как есть,
 * базу удаляем, Dexie создаёт её заново, строки возвращаются (restoreRows).
 * Таблицы, которых в схеме нет (старые кэши видео), уходят вместе с базой.
 * Версия на диске уже текущая — проверять нечего: один вызов databases().
 */
async function takeRowsIfKeysChanged(): Promise<Map<string, unknown[]> | null> {
  const listed = await indexedDB.databases?.().catch(() => null)
  const onDisk = listed?.find((d) => d.name === db.name)
  if (listed && (!onDisk || onDisk.version === Math.round(db.verno * 10))) return null

  const idb = await openExisting(db.name)
  if (!idb) return null
  let rows: Map<string, unknown[]>
  try {
    const present = db.tables.filter((t) => idb.objectStoreNames.contains(t.name))
    if (!present.length) return null
    const tx = idb.transaction(
      present.map((t) => t.name),
      'readonly'
    )
    // Сравнение как у Dexie (getSchemaDiff): путь ключа строкой и автоинкремент.
    const keyChanged = present.some((t) => {
      const store = tx.objectStore(t.name)
      const { keyPath, auto } = t.schema.primKey
      return String(store.keyPath ?? '') !== String(keyPath ?? '') || store.autoIncrement !== !!auto
    })
    if (!keyChanged) return null
    rows = new Map()
    await Promise.all(
      present.map((t) => settle(tx.objectStore(t.name).getAll()).then((r) => rows.set(t.name, r)))
    )
  } finally {
    idb.close()
  }
  console.warn('[db] primary keys on disk differ from the schema, rebuilding with the same rows')
  await Dexie.delete(db.name)
  return rows
}

async function restoreRows(rows: Map<string, unknown[]>): Promise<void> {
  for (const table of db.tables) {
    const saved = rows.get(table.name)
    if (!saved?.length) continue
    // Избранное без аккаунта — как в апгрейде v3: переедет к аккаунту при
    // первом обращении (favoritesAPI.adoptLegacy).
    const fixed =
      table.name === 'favorites'
        ? saved.map((row) =>
            typeof (row as { address?: unknown }).address === 'string'
              ? row
              : { ...(row as object), address: '' }
          )
        : saved
    // Строка без полей нового ключа не ляжет — остальные запишутся (BulkError).
    await table
      .bulkPut(fixed)
      .catch((e: unknown) => console.warn(`[db] ${table.name}: some rows were not restored:`, e))
  }
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Открыть базу как есть, без обновления схемы; нет базы — null (и не создаём её). */
function openExisting(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open(name)
    req.onupgradeneeded = () => req.transaction?.abort()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}
