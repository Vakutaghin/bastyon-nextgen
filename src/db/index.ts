// Экспорт типов
export type { BaseEntity, VideoData, ContentCache, TranscodedVideo, FavoritePost, StoredNotification } from './types'

// Экспорт базы данных и функций инициализации
export { AppDatabase, db, initDatabase, clearDatabase } from './database'

// Экспорт утилит
export { setTimestamps } from './utils'

// Экспорт API
export { videoAPI } from './apis/video-api'
export { cacheAPI } from './apis/cache-api'
export { transcodedVideoAPI } from './apis/transcoded-video-api'
export { postRatingPendingAPI } from './apis/post-rating-pending-api'
export { settingsAPI } from './apis/settings-api'
export { notificationsAPI } from './apis/notifications-api'

// Импорты для default export
import { db, initDatabase, clearDatabase } from './database'
import { videoAPI } from './apis/video-api'
import { cacheAPI } from './apis/cache-api'
import { transcodedVideoAPI } from './apis/transcoded-video-api'
import { postRatingPendingAPI } from './apis/post-rating-pending-api'
import { settingsAPI } from './apis/settings-api'
import { notificationsAPI } from './apis/notifications-api'

// Экспортируем все API для обратной совместимости
export default {
  db,
  initDatabase,
  clearDatabase,
  videoAPI,
  cacheAPI,
  transcodedVideoAPI,
  postRatingPendingAPI,
  settingsAPI,
  notificationsAPI
}
