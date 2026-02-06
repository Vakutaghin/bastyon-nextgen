# IndexedDB API

Этот модуль предоставляет удобный API для работы с IndexedDB через библиотеку Dexie.js.

## Инициализация

База данных автоматически инициализируется при старте приложения в `main.js`.

## Структура базы данных

### Таблицы

- **videos** - хранение данных о видео
- **contentCache** - кэш контента с поддержкой TTL

## Использование

### Импорт

```typescript
import { db, videoAPI, cacheAPI } from '@/db'
// или
import dbModule from '@/db'
```

### API для работы с видео

```typescript
import { videoAPI } from '@/db'

// Сохранить видео
await videoAPI.save({
  id: 'video-123',
  url: 'https://example.com/video.mp4',
  title: 'Example Video',
  thumbnail: 'https://example.com/thumb.jpg',
  duration: 120,
  metadata: { quality: '1080p' }
})

// Получить видео по ID
const video = await videoAPI.get('video-123')

// Получить все видео
const allVideos = await videoAPI.getAll()

// Найти видео по URL
const videoByUrl = await videoAPI.findByUrl('https://example.com/video.mp4')

// Получить последние видео
const recentVideos = await videoAPI.getRecent(10)

// Удалить видео
await videoAPI.delete('video-123')
```

### API для работы с кэшем

```typescript
import { cacheAPI } from '@/db'

// Сохранить данные в кэш (TTL в миллисекундах)
await cacheAPI.set('user-data', { name: 'John' }, 3600000) // 1 час

// Получить данные из кэша
const data = await cacheAPI.get('user-data')

// Удалить элемент из кэша
await cacheAPI.delete('user-data')

// Очистить просроченный кэш
const clearedCount = await cacheAPI.clearExpired()

// Очистить весь кэш
await cacheAPI.clearAll()
```

### Прямой доступ к базе данных

Если нужен более сложный запрос, можно использовать Dexie API напрямую:

```typescript
import { db } from '@/db'

// Пример сложного запроса
const videos = await db.videos
  .where('duration')
  .above(60)
  .and(video => video.metadata?.quality === '1080p')
  .toArray()

// Транзакции
await db.transaction('rw', db.videos, db.contentCache, async () => {
  await db.videos.add({ id: 'new-video', url: '...' })
  await db.contentCache.add({ key: 'cache-key', data: {} })
})
```

## Расширение схемы базы данных

Для добавления новых таблиц или изменения схемы:

1. Обновите интерфейсы в `src/db/index.ts`
2. Добавьте таблицу в класс `AppDatabase`
3. Увеличьте версию базы данных в методе `version()`
4. Добавьте новую таблицу в объект `stores`

Пример:

```typescript
export interface UserData extends BaseEntity {
  id: string
  username: string
  email: string
}

export class AppDatabase extends Dexie {
  videos!: Table<VideoData, string>
  contentCache!: Table<ContentCache, string>
  users!: Table<UserData, string> // Новая таблица

  constructor() {
    super('BastyonDB')
    
    this.version(2).stores({ // Увеличиваем версию
      videos: 'id, url, createdAt',
      contentCache: 'key, expiresAt, createdAt',
      users: 'id, username, email, createdAt' // Новая таблица
    })
  }
}
```

## Утилиты

### setTimestamps

Автоматически устанавливает `createdAt` и `updatedAt`:

```typescript
import { setTimestamps } from '@/db'

const entity = setTimestamps({ id: '123', name: 'Test' }, true) // isNew = true
// entity.createdAt и entity.updatedAt будут установлены
```

## Очистка базы данных

```typescript
import { clearDatabase } from '@/db'

// Очистить и переинициализировать базу данных
await clearDatabase()
```

## Миграции

При изменении схемы базы данных Dexie автоматически выполнит миграцию. Для более сложных миграций можно использовать:

```typescript
this.version(2).stores({
  videos: 'id, url, createdAt, category' // Добавлено новое поле
}).upgrade(tx => {
  // Логика миграции
  return tx.table('videos').toCollection().modify(video => {
    video.category = 'default'
  })
})
```
