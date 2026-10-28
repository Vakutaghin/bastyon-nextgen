// Сведения о роликах и треках для карточек разделов «Видео» и «Аудио»:
// превью, длительность, просмотры. Одним запросом к ноде на пачку
// (`peertube/videos`, её кэш) — не по запросу к PeerTube на каждую карточку,
// как у плеера. Ответы живут в памяти несколько минут: разделы, профиль и
// плейлисты спрашивают одни и те же ролики.

import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { peertubeArchiveFor } from '@/helpers/api/peertube-archive'
import { getVideosInfo, type NodeVideoInfo } from '@/services/peertube/peertube-videos'
import { logger } from '@/services/logger'

const log = logger.scope('[media-info]')

export interface MediaInfo {
  /** Превью; null — у сервера его нет или он не ответил. */
  thumbnail: string | null
  /** Длительность, секунды. */
  duration: number | null
  views: number | null
}

/** Ссылок в одном запросе к ноде. */
const BATCH = 40
const TTL_MS = 10 * 60_000

interface Entry {
  info: MediaInfo
  expires: number
}

const cache = new Map<string, Entry>()

/** Превью по указателю и сведениям ноды: выведенный сервер — из его архива. */
export function thumbnailOf(
  url: string,
  info: Pick<NodeVideoInfo, 'thumbnailPath'>
): string | null {
  const path = info.thumbnailPath
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const host = parsePeerTubeUrl(url)?.host
  if (!host) return null
  return `https://${peertubeArchiveFor(host) ?? host}${path}`
}

export function toMediaInfo(url: string, info: NodeVideoInfo): MediaInfo {
  return {
    thumbnail: thumbnailOf(url, info),
    duration: typeof info.duration === 'number' && info.duration > 0 ? info.duration : null,
    views: typeof info.views === 'number' ? info.views : null,
  }
}

/** Что уже известно о ссылке, без запроса. */
export function cachedMediaInfo(url: string): MediaInfo | null {
  const entry = cache.get(url)
  return entry && entry.expires > Date.now() ? entry.info : null
}

/**
 * Сведения о ссылках `peertube://…`. Чего нода не знает (сервер не ответил),
 * в ответе нет; повторный вызов спросит снова.
 */
export async function fetchMediaInfo(
  urls: readonly string[],
  fetchInfo: typeof getVideosInfo = getVideosInfo
): Promise<Map<string, MediaInfo>> {
  const out = new Map<string, MediaInfo>()
  const missing: string[] = []
  for (const url of new Set(urls)) {
    if (!url.startsWith('peertube://')) continue
    const known = cachedMediaInfo(url)
    if (known) out.set(url, known)
    else missing.push(url)
  }
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH)
    try {
      const infos = await fetchInfo({ urls: batch })
      for (const [url, raw] of infos) {
        const info = toMediaInfo(url, raw)
        cache.set(url, { info, expires: Date.now() + TTL_MS })
        out.set(url, info)
      }
    } catch (e) {
      log.warn('peertube/videos failed', e)
    }
  }
  return out
}

/** Для тестов. */
export function clearMediaInfoCache(): void {
  cache.clear()
}
