/**
 * Утилиты для работы с PeerTube URL и получением информации о видео
 */

/**
 * Распарсенный PeerTube URL
 */
export interface PeerTubeUrl {
  host: string
  videoId: string
  type?: 'video' | 'audio' | 'stream'
}

/**
 * Информация о видео с PeerTube сервера
 */
export interface PeerTubeVideoInfo {
  id: number
  uuid: string
  name: string
  description?: string
  thumbnailPath?: string
  previewPath?: string
  thumbnailUrl?: string
  previewUrl?: string
  streamingPlaylists?: Array<{
    id: number
    playlistUrl: string
    segmentsSha256Url?: string
    files?: Array<{
      resolution?: {
        id: number
        label: string
      }
      fileUrl?: string
      size?: number
    }>
  }>
  files?: Array<{
    resolution?: {
      id: number
      label: string
    }
    fileUrl?: string
    size?: number
  }>
}

/**
 * Парсит PeerTube URL в формате peertube://host/videoid или peertube://host/videoid/type
 *
 * @param url - URL в формате peertube://host/videoid
 * @returns Распарсенный URL или null, если формат неверный
 *
 * @example
 * parsePeerTubeUrl('peertube://peertube359.pocketnet.app/abc123')
 * // { host: 'peertube359.pocketnet.app', videoId: 'abc123', type: undefined }
 *
 * @example
 * parsePeerTubeUrl('peertube://host/videoid/audio')
 * // { host: 'host', videoId: 'videoid', type: 'audio' }
 */
export function parsePeerTubeUrl(url: string): PeerTubeUrl | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  // Убираем пробелы в начале и конце
  url = url.trim()

  // Проверяем формат peertube://
  const match = url.match(/^peertube:\/\/([^/]+)\/([^/]+)(?:\/(.+))?$/)
  if (!match) {
    return null
  }

  const host = match[1]
  const videoId = match[2]
  const type = match[3] as 'video' | 'audio' | 'stream' | undefined

  // Валидация: host и videoId не должны быть пустыми
  if (!host || !videoId) {
    return null
  }

  return {
    host,
    videoId,
    type
  }
}

/**
 * Получает информацию о видео с PeerTube сервера через API
 *
 * @param host - Хост PeerTube сервера (например, 'peertube359.pocketnet.app')
 * @param videoId - ID видео (UUID или короткий ID)
 * @returns Promise с информацией о видео
 *
 * @throws {Error} Если запрос не удался или видео не найдено
 *
 * @example
 * const info = await getPeerTubeVideoInfo('peertube359.pocketnet.app', 'abc123')
 */
export async function getPeerTubeVideoInfo(
  host: string,
  videoId: string
): Promise<PeerTubeVideoInfo> {
  if (!host || !videoId) {
    throw new Error('Host and videoId are required')
  }

  // Формируем URL API
  // PeerTube API: GET /api/v1/videos/{id}
  const apiUrl = `https://${host}/api/v1/videos/${videoId}`

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        // Добавляем Referer для совместимости с некоторыми серверами
        'Referer': typeof window !== 'undefined' ? window.location.origin : ''
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Video not found: ${videoId}`)
      }
      throw new Error(
        `Failed to fetch video info: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()
    return data as PeerTubeVideoInfo
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown error while fetching video info')
  }
}

/**
 * Извлекает HLS плейлист URL из информации о видео
 * 
 * Приоритет:
 * 1. streamingPlaylists[0].playlistUrl (HLS плейлист)
 * 2. Если нет streamingPlaylists, пытаемся построить URL по паттерну
 * 
 * @param videoInfo - Информация о видео с PeerTube API
 * @returns URL HLS плейлиста или null, если не найден
 * 
 * @example
 * const playlistUrl = getHlsPlaylistUrl(videoInfo)
 * // 'https://host/static/streaming-playlists/hls/videoId/playlistId-master.m3u8'
 */
export function getHlsPlaylistUrl(
  videoInfo: PeerTubeVideoInfo
): string | null {
  if (!videoInfo) {
    return null
  }

  // Приоритет 1: Используем streamingPlaylists (HLS)
  if (
    videoInfo.streamingPlaylists &&
    Array.isArray(videoInfo.streamingPlaylists) &&
    videoInfo.streamingPlaylists.length > 0
  ) {
    const playlist = videoInfo.streamingPlaylists[0]
    if (playlist.playlistUrl) {
      return playlist.playlistUrl
    }
  }

  // Приоритет 2: Если есть files с fileUrl, используем первый
  // (для прямых видео файлов, не HLS)
  if (videoInfo.files && Array.isArray(videoInfo.files) && videoInfo.files.length > 0) {
    const file = videoInfo.files[0]
    if (file.fileUrl) {
      return file.fileUrl
    }
  }

  return null
}

/**
 * Получает URL превьюшки (thumbnail) видео
 * 
 * @param videoInfo - Информация о видео с PeerTube API
 * @param host - Хост PeerTube сервера
 * @returns URL превьюшки или null, если не найдена
 * 
 * @example
 * const thumbnailUrl = getVideoThumbnailUrl(videoInfo, 'peertube359.pocketnet.app')
 * // 'https://peertube359.pocketnet.app/static/thumbnails/videoId.jpg'
 */
export function getVideoThumbnailUrl(
  videoInfo: PeerTubeVideoInfo,
  host: string
): string | null {
  if (!videoInfo || !host) {
    return null
  }

  // Приоритет 1: Используем thumbnailUrl если есть
  if (videoInfo.thumbnailUrl) {
    // Если это полный URL, возвращаем как есть
    if (videoInfo.thumbnailUrl.startsWith('http://') || videoInfo.thumbnailUrl.startsWith('https://')) {
      return videoInfo.thumbnailUrl
    }
    // Если относительный путь, добавляем хост
    return `https://${host}${videoInfo.thumbnailUrl.startsWith('/') ? '' : '/'}${videoInfo.thumbnailUrl}`
  }

  // Приоритет 2: Используем thumbnailPath
  if (videoInfo.thumbnailPath) {
    return `https://${host}${videoInfo.thumbnailPath.startsWith('/') ? '' : '/'}${videoInfo.thumbnailPath}`
  }

  // Приоритет 3: Используем previewUrl
  if (videoInfo.previewUrl) {
    if (videoInfo.previewUrl.startsWith('http://') || videoInfo.previewUrl.startsWith('https://')) {
      return videoInfo.previewUrl
    }
    return `https://${host}${videoInfo.previewUrl.startsWith('/') ? '' : '/'}${videoInfo.previewUrl}`
  }

  // Приоритет 4: Используем previewPath
  if (videoInfo.previewPath) {
    return `https://${host}${videoInfo.previewPath.startsWith('/') ? '' : '/'}${videoInfo.previewPath}`
  }

  // Fallback: строим URL по стандартному паттерну PeerTube
  // Обычно превьюшки находятся в /static/thumbnails/{uuid}.jpg
  if (videoInfo.uuid) {
    return `https://${host}/static/thumbnails/${videoInfo.uuid}.jpg`
  }

  return null
}

/**
 * Получает URL превьюшки напрямую из PeerTube URL
 * 
 * @param peertubeUrl - URL в формате peertube://host/videoid
 * @returns Promise с URL превьюшки или null
 * 
 * @throws {Error} Если URL неверный или видео не найдено
 */
export async function getVideoThumbnailFromUrl(
  peertubeUrl: string
): Promise<string | null> {
  // Парсим URL
  const parsed = parsePeerTubeUrl(peertubeUrl)
  if (!parsed) {
    throw new Error(`Invalid PeerTube URL: ${peertubeUrl}`)
  }

  // Получаем информацию о видео
  const videoInfo = await getPeerTubeVideoInfo(parsed.host, parsed.videoId)

  // Извлекаем URL превьюшки
  return getVideoThumbnailUrl(videoInfo, parsed.host)
}

/**
 * Получает HLS плейлист URL напрямую из PeerTube URL
 *
 * Удобная функция, которая объединяет парсинг URL, получение информации
 * и извлечение плейлиста в один вызов.
 *
 * @param peertubeUrl - URL в формате peertube://host/videoid
 * @returns Promise с URL HLS плейлиста или null
 *
 * @throws {Error} Если URL неверный или видео не найдено
 *
 * @example
 * const playlistUrl = await getHlsPlaylistFromUrl('peertube://host/videoid')
 */
export async function getHlsPlaylistFromUrl(
  peertubeUrl: string
): Promise<string | null> {
  // Парсим URL
  const parsed = parsePeerTubeUrl(peertubeUrl)
  if (!parsed) {
    throw new Error(`Invalid PeerTube URL: ${peertubeUrl}`)
  }

  // Получаем информацию о видео
  const videoInfo = await getPeerTubeVideoInfo(parsed.host, parsed.videoId)

  // Извлекаем HLS плейлист
  return getHlsPlaylistUrl(videoInfo)
}
