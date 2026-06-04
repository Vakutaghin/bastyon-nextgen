/**
 * Определение видео-ссылки в тексте поста (без сетевых запросов).
 *
 * Поддерживаются разблокированные (эмбедируемые без аплоадера) источники:
 *   - YouTube / Vimeo — iframe-эмбед,
 *   - PeerTube (`peertube://host/id[/audio]`) — отдаётся как есть (operationType video/audio).
 *
 * OG-превью обычных веб-ссылок здесь НЕ делается — нужен метаданные-эндпойнт ноды.
 */

import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'

export type ParsedVideoKind = 'youtube' | 'vimeo' | 'peertube' | 'audio' | null

export interface ParsedVideo {
  kind: ParsedVideoKind
  /** Исходная ссылка. */
  url: string
  /** URL для iframe (youtube/vimeo); пусто для peertube. */
  embedUrl?: string
}

/** Извлекает 11-символьный YouTube video ID (youtube.com/watch?v=, youtu.be/, /embed/, /shorts/). */
export function extractYoutubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  return m ? m[1] : null
}

/** Извлекает числовой Vimeo video ID (vimeo.com/123456789). */
export function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/)
  return m ? m[1] : null
}

/** Разбирает одиночную ссылку в ParsedVideo. */
export function parseVideoUrl(url: string): ParsedVideo {
  const trimmed = (url || '').trim()
  if (!trimmed) return { kind: null, url: '' }

  const pt = parsePeerTubeUrl(trimmed)
  if (pt) {
    return { kind: pt.type === 'audio' ? 'audio' : 'peertube', url: trimmed }
  }

  const yt = extractYoutubeId(trimmed)
  if (yt) {
    return { kind: 'youtube', url: trimmed, embedUrl: `https://www.youtube.com/embed/${yt}` }
  }

  const vm = extractVimeoId(trimmed)
  if (vm) {
    return { kind: 'vimeo', url: trimmed, embedUrl: `https://player.vimeo.com/video/${vm}` }
  }

  return { kind: null, url: trimmed }
}

/** Находит первую видео-ссылку в произвольном тексте (или '' если нет). */
export function firstVideoUrl(text: string): string {
  if (!text) return ''
  const tokens = text.match(/(?:peertube:\/\/|https?:\/\/)[^\s"')\]]+/gi) || []
  for (const token of tokens) {
    if (parseVideoUrl(token).kind) return token
  }
  return ''
}
