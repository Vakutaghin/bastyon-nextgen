// Удобные композиторы и URL-helpers для PeerTube. Парсер и API — в отдельных файлах
// (peertube-parser.ts, peertube-api.ts). Этот файл оставлен как barrel для совместимости
// со старыми импортами `@/helpers/api/peertube-url`.

import { parsePeerTubeUrl } from './peertube-parser'
import { getPeerTubeVideoInfo, type PeerTubeVideoInfo } from './peertube-api'

// Re-exports для обратной совместимости с импортёрами.
export { parsePeerTubeUrl } from './peertube-parser'
export type { PeerTubeUrl } from './peertube-parser'
export { getPeerTubeVideoInfo, PeerTubeFetchError } from './peertube-api'
export type { PeerTubeVideoInfo, PeerTubeFetchErrorCode } from './peertube-api'

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

/** Кандидат для прогрессивного воспроизведения: прямой файл + его высота (для выбора). */
interface ProgressiveCandidate {
  height: number
  url: string
}

/** Собирает все прямые файлы (mp4) из top-level `files` и из `streamingPlaylists[].files`. */
function collectProgressiveFiles(videoInfo: PeerTubeVideoInfo): ProgressiveCandidate[] {
  const out: ProgressiveCandidate[] = []
  const push = (files?: PeerTubeVideoInfo['files']): void => {
    if (!Array.isArray(files)) return
    for (const f of files) {
      if (f?.fileUrl) out.push({ height: f.resolution?.id ?? 0, url: f.fileUrl })
    }
  }
  push(videoInfo.files)
  if (Array.isArray(videoInfo.streamingPlaylists)) {
    for (const pl of videoInfo.streamingPlaylists) push(pl?.files)
  }
  return out
}

/**
 * Прямой URL прогрессивного видеофайла (mp4) — для fallback, когда HLS фатально не
 * воспроизводится. Берётся из той же ноды (данные уже в ответе API, отдельная инфра не нужна).
 *
 * Выбор: наибольшее разрешение ≤ 720p (баланс качество/вес для аварийного пути);
 * если все выше 720p — наименьшее известное; иначе первый доступный файл.
 */
export function getProgressiveVideoUrl(videoInfo: PeerTubeVideoInfo): string | null {
  if (!videoInfo) return null
  const files = collectProgressiveFiles(videoInfo)
  if (files.length === 0) return null

  const atMost720 = files.filter((f) => f.height > 0 && f.height <= 720)
  if (atMost720.length > 0) {
    return atMost720.reduce((best, f) => (f.height > best.height ? f : best)).url
  }

  const known = files.filter((f) => f.height > 0)
  if (known.length > 0) {
    return known.reduce((min, f) => (f.height < min.height ? f : min)).url
  }

  return files[0].url
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

/** Источники воспроизведения для плеера: настоящий HLS-плейлист и прогрессивный mp4-fallback. */
export interface VideoSources {
  /** URL HLS-плейлиста (.m3u8). null, если на ноде нет HLS-варианта. */
  hlsPlaylistUrl: string | null
  /** Прямой mp4 на той же ноде — fallback, если HLS не воспроизводится. null, если нет файлов. */
  progressiveUrl: string | null
}

/**
 * Источники видео из PeerTube URL за один сетевой запрос (parser + API + извлечение обоих URL).
 *
 * В отличие от {@link getHlsPlaylistFromUrl}, чётко разделяет HLS (только `streamingPlaylists`)
 * и прогрессивный mp4 — чтобы плеер мог деградировать с HLS на прямой файл, а не кормить
 * mp4 в hls.js (что сломало бы воспроизведение).
 *
 * Бросает Error если URL неверный или видео не найдено.
 */
export async function getVideoSourcesFromUrl(peertubeUrl: string): Promise<VideoSources> {
  const parsed = parsePeerTubeUrl(peertubeUrl)
  if (!parsed) throw new Error(`Invalid PeerTube URL: ${peertubeUrl}`)

  const videoInfo = await getPeerTubeVideoInfo(parsed.host, parsed.videoId)
  const hlsPlaylistUrl = videoInfo.streamingPlaylists?.[0]?.playlistUrl ?? null
  return { hlsPlaylistUrl, progressiveUrl: getProgressiveVideoUrl(videoInfo) }
}
