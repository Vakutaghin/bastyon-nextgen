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

/** Опции суффикса указателя (взаимоисключающие; audio имеет приоритет). */
export interface ComposePeerTubeUrlOptions {
  isAudio?: boolean
  isLive?: boolean
}

/**
 * Строит канонический указатель `peertube://host/videoid[/audio|/stream]`.
 * Пара к parsePeerTubeUrl (kit.js composeLink:151-158): суффикс `/audio` для аудио,
 * `/stream` для лайва. Именно эта строка кладётся в post.url (operationType выводится из неё).
 *
 * @example composePeerTubeUrl('h', 'abc') // 'peertube://h/abc'
 * @example composePeerTubeUrl('h', 'abc', { isAudio: true }) // 'peertube://h/abc/audio'
 */
export function composePeerTubeUrl(
  host: string,
  videoId: string,
  options: ComposePeerTubeUrlOptions = {}
): string {
  if (!host || !videoId) throw new Error('peertube_pointer_invalid')
  const base = `peertube://${host}/${videoId}`
  if (options.isAudio) return `${base}/audio`
  if (options.isLive) return `${base}/stream`
  return base
}
