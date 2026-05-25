/**
 * Утилиты для работы с PeerTube URL и получением информации о видео
 */

import { appFetch } from '@/helpers/api/request'

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
    type,
  }
}

/** Параметры retry для PeerTube API запросов */
const PEERTUBE_FETCH_TIMEOUT_MS = 10_000
const PEERTUBE_MAX_RETRIES = 3
const PEERTUBE_RETRY_BASE_DELAY_MS = 500

/**
 * Одна попытка fetch с таймаутом через AbortController.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await appFetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Получает информацию о видео с PeerTube сервера через API.
 *
 * Делает до 3 попыток с экспоненциальным backoff (500ms / 1s / 2s) и таймаутом 10s
 * на каждую попытку. 404 не ретраится — это окончательный ответ.
 *
 * @param host - Хост PeerTube сервера (например, 'peertube359.pocketnet.app')
 * @param videoId - ID видео (UUID или короткий ID)
 * @returns Promise с информацией о видео
 *
 * @throws {Error} Если все попытки исчерпаны или видео не найдено
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

  // В dev в браузере — запрос через Vite proxy, чтобы обойти CORS
  const isDevBrowser =
    typeof import.meta !== 'undefined' &&
    import.meta.env?.DEV === true &&
    typeof window !== 'undefined'
  const apiUrl = isDevBrowser
    ? `/api/peertube/${host}/api/v1/videos/${videoId}`
    : `https://${host}/api/v1/videos/${videoId}`

  const init: RequestInit = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      // Добавляем Referer для совместимости с некоторыми серверами
      Referer: typeof window !== 'undefined' ? window.location.origin : '',
    },
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < PEERTUBE_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(apiUrl, init, PEERTUBE_FETCH_TIMEOUT_MS)

      // 404 не ретраим — это окончательный ответ "видео не существует"
      if (response.status === 404) {
        throw new Error(`Video not found: ${videoId}`)
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch video info: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data as PeerTubeVideoInfo
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : JSON.stringify(error))

      // 404 пробрасываем сразу, не ретраим
      if (err.message.startsWith('Video not found:')) {
        throw err
      }

      lastError = err
      const isLastAttempt = attempt === PEERTUBE_MAX_RETRIES - 1
      if (isLastAttempt) break

      const delay = PEERTUBE_RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
      console.warn(
        `PeerTube fetch attempt ${attempt + 1}/${PEERTUBE_MAX_RETRIES} failed (${err.message}), retrying in ${delay}ms`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError ?? new Error('peertube fetch failed: unknown error')
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
export function getHlsPlaylistUrl(videoInfo: PeerTubeVideoInfo): string | null {
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
    if (playlist?.playlistUrl) {
      return playlist.playlistUrl
    }
  }

  // Приоритет 2: Если есть files с fileUrl, используем первый
  // (для прямых видео файлов, не HLS)
  if (videoInfo.files && Array.isArray(videoInfo.files) && videoInfo.files.length > 0) {
    const file = videoInfo.files[0]
    if (file?.fileUrl) {
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
export function getVideoThumbnailUrl(videoInfo: PeerTubeVideoInfo, host: string): string | null {
  if (!videoInfo || !host) {
    return null
  }

  // Приоритет 1: Используем thumbnailUrl если есть
  if (videoInfo.thumbnailUrl) {
    // Если это полный URL, возвращаем как есть
    if (
      videoInfo.thumbnailUrl.startsWith('http://') ||
      videoInfo.thumbnailUrl.startsWith('https://')
    ) {
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
export async function getVideoThumbnailFromUrl(peertubeUrl: string): Promise<string | null> {
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
export async function getHlsPlaylistFromUrl(peertubeUrl: string): Promise<string | null> {
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
