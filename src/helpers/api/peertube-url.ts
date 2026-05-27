// Удобные композиторы и URL-helpers для PeerTube. Парсер и API — в отдельных файлах
// (peertube-parser.ts, peertube-api.ts). Этот файл оставлен как barrel для совместимости
// со старыми импортами `@/helpers/api/peertube-url`.

import { parsePeerTubeUrl } from './peertube-parser'
import { getPeerTubeVideoInfo, type PeerTubeVideoInfo } from './peertube-api'

// Re-exports для обратной совместимости с импортёрами.
export { parsePeerTubeUrl } from './peertube-parser'
export type { PeerTubeUrl } from './peertube-parser'
export { getPeerTubeVideoInfo } from './peertube-api'
export type { PeerTubeVideoInfo } from './peertube-api'

/**
 * Извлекает HLS плейлист URL из информации о видео.
 *
 * Приоритет:
 *  1. streamingPlaylists[0].playlistUrl (HLS плейлист).
 *  2. files[0].fileUrl (прямой видеофайл, не HLS) — fallback.
 */
export function getHlsPlaylistUrl(videoInfo: PeerTubeVideoInfo): string | null {
  if (!videoInfo) return null

  if (
    videoInfo.streamingPlaylists &&
    Array.isArray(videoInfo.streamingPlaylists) &&
    videoInfo.streamingPlaylists.length > 0
  ) {
    const playlist = videoInfo.streamingPlaylists[0]
    if (playlist?.playlistUrl) return playlist.playlistUrl
  }

  if (videoInfo.files && Array.isArray(videoInfo.files) && videoInfo.files.length > 0) {
    const file = videoInfo.files[0]
    if (file?.fileUrl) return file.fileUrl
  }

  return null
}

/**
 * URL превьюшки видео. Приоритет: thumbnailUrl → thumbnailPath → previewUrl → previewPath →
 * fallback по стандартному паттерну PeerTube /static/thumbnails/{uuid}.jpg.
 * Относительные пути достраиваются через `host`.
 */
export function getVideoThumbnailUrl(videoInfo: PeerTubeVideoInfo, host: string): string | null {
  if (!videoInfo || !host) return null

  const resolveAgainstHost = (path: string): string => {
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    return `https://${host}${path.startsWith('/') ? '' : '/'}${path}`
  }

  if (videoInfo.thumbnailUrl) return resolveAgainstHost(videoInfo.thumbnailUrl)
  if (videoInfo.thumbnailPath) return resolveAgainstHost(videoInfo.thumbnailPath)
  if (videoInfo.previewUrl) return resolveAgainstHost(videoInfo.previewUrl)
  if (videoInfo.previewPath) return resolveAgainstHost(videoInfo.previewPath)

  // Fallback на стандартный паттерн PeerTube.
  if (videoInfo.uuid) return `https://${host}/static/thumbnails/${videoInfo.uuid}.jpg`

  return null
}

/**
 * Получает URL превьюшки напрямую из PeerTube URL (parser + API + thumbnail extract).
 * Бросает Error если URL неверный или видео не найдено.
 */
export async function getVideoThumbnailFromUrl(peertubeUrl: string): Promise<string | null> {
  const parsed = parsePeerTubeUrl(peertubeUrl)
  if (!parsed) throw new Error(`Invalid PeerTube URL: ${peertubeUrl}`)

  const videoInfo = await getPeerTubeVideoInfo(parsed.host, parsed.videoId)
  return getVideoThumbnailUrl(videoInfo, parsed.host)
}

/**
 * Получает HLS плейлист URL напрямую из PeerTube URL (parser + API + HLS extract).
 * Бросает Error если URL неверный или видео не найдено.
 */
export async function getHlsPlaylistFromUrl(peertubeUrl: string): Promise<string | null> {
  const parsed = parsePeerTubeUrl(peertubeUrl)
  if (!parsed) throw new Error(`Invalid PeerTube URL: ${peertubeUrl}`)

  const videoInfo = await getPeerTubeVideoInfo(parsed.host, parsed.videoId)
  return getHlsPlaylistUrl(videoInfo)
}
