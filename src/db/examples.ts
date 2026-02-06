/**
 * Примеры использования IndexedDB API
 * Этот файл можно удалить после ознакомления
 */

import { videoAPI, cacheAPI, db } from './index'

// ============================================
// Примеры работы с видео
// ============================================

export async function exampleSaveVideo() {
  // Сохранение видео с метаданными
  await videoAPI.save({
    id: 'video-001',
    url: 'https://example.com/video.mp4',
    title: 'Пример видео',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: 3600,
    metadata: {
      quality: '1080p',
      format: 'mp4',
      size: 1024000
    }
  })
}

export async function exampleGetVideo() {
  // Получение видео по ID
  const video = await videoAPI.get('video-001')
}

export async function exampleFindVideoByUrl() {
  // Поиск видео по URL
  const video = await videoAPI.findByUrl('https://example.com/video.mp4')
  return video
}

export async function exampleGetRecentVideos() {
  // Получение последних 10 видео
  const recentVideos = await videoAPI.getRecent(10)
  return recentVideos
}

// ============================================
// Примеры работы с кэшем
// ============================================

export async function exampleCacheData() {
  // Кэширование данных на 1 час (3600000 мс)
  await cacheAPI.set('user-profile', {
    id: 'user-123',
    name: 'Иван Иванов',
    email: 'ivan@example.com'
  }, 3600000)
}

export async function exampleGetCachedData() {
  // Получение данных из кэша
  const userProfile = await cacheAPI.get('user-profile')
}

export async function exampleClearExpiredCache() {
  // Очистка просроченного кэша
  const clearedCount = await cacheAPI.clearExpired()
  console.info(`Удалено ${clearedCount} просроченных записей`)
}

// ============================================
// Примеры сложных запросов
// ============================================

export async function exampleComplexQuery() {
  // Поиск всех видео с длительностью больше 60 секунд
  const longVideos = await db.videos
    .where('duration')
    .above(60)
    .toArray()

  return longVideos
}

export async function exampleTransaction() {
  // Использование транзакций для атомарных операций
  await db.transaction('rw', db.videos, db.contentCache, async () => {
    // Сохраняем видео
    await videoAPI.save({
      id: 'video-002',
      url: 'https://example.com/video2.mp4',
      title: 'Второе видео'
    })

    // Сохраняем связанные данные в кэш
    await cacheAPI.set('video-002-metadata', {
      views: 0,
      likes: 0
    })
  })
}

// ============================================
// Пример использования в Vue компоненте
// ============================================

/*
import { defineComponent, ref, onMounted } from 'vue'
import { videoAPI } from '@/db'

export default defineComponent({
  setup() {
    const videos = ref([])

    onMounted(async () => {
      // Загружаем видео из IndexedDB
      videos.value = await videoAPI.getAll()
    })

    const saveVideo = async (videoData) => {
      await videoAPI.save(videoData)
      // Обновляем список
      videos.value = await videoAPI.getAll()
    }

    return {
      videos,
      saveVideo
    }
  }
})
*/
