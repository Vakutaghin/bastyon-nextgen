// Парсинг URL вида peertube://host/videoid[/type]. Чистая функция без сетевых запросов.

/** Распарсенный PeerTube URL. */
export interface PeerTubeUrl {
  host: string
  videoId: string
  type?: 'video' | 'audio' | 'stream'
}

/**
 * Парсит PeerTube URL в формате peertube://host/videoid или peertube://host/videoid/type.
 * Возвращает null если формат неверный (или host/videoId пустые).
 *
 * Поддерживает URL-encoded форму (peertube%3A%2F%2Fhost%2Fid) — однократно декодирует.
 *
 * @example parsePeerTubeUrl('peertube://peertube359.pocketnet.app/abc123')
 * // { host: 'peertube359.pocketnet.app', videoId: 'abc123', type: undefined }
 *
 * @example parsePeerTubeUrl('peertube://host/videoid/audio')
 * // { host: 'host', videoId: 'videoid', type: 'audio' }
 */
export function parsePeerTubeUrl(url: string): PeerTubeUrl | null {
  if (!url || typeof url !== 'string') return null

  url = url.trim()

  // URL может приходить URL-encoded (peertube%3A%2F%2Fhost%2Fid) — например,
  // если был пропущен через encodeURIComponent на стороне фронта или ноды.
  if (url.toLowerCase().startsWith('peertube%3a')) {
    try {
      url = decodeURIComponent(url)
    } catch {
      return null
    }
  }

  const match = url.match(/^peertube:\/\/([^/]+)\/([^/]+)(?:\/(.+))?$/)
  if (!match) return null

  const host = match[1]
  const videoId = match[2]
  const type = match[3] as 'video' | 'audio' | 'stream' | undefined
  if (!host || !videoId) return null

  return { host, videoId, type }
}
