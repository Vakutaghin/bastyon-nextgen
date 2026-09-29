/**
 * Единственный разбор видео-ссылок (S31).
 *
 * Было два парсера: композер знал `shorts/` и `embed/`, лента — только
 * `watch?v=` и `youtu.be/`. Пост с ссылкой на shorts показывал превью в
 * композере и ничего в ленте; хвостовая пунктуация («…youtu.be/ID.») уезжала
 * в сохранённую ссылку. Vimeo знал только композер.
 *
 * Поддерживаются источники, которые встраиваются без нашего аплоадера:
 *   - YouTube / Vimeo — iframe-эмбед,
 *   - PeerTube (`peertube://host/id[/audio]`) — отдаётся как есть.
 *
 * Обычную веб-ссылку (не видео и не картинку) находит `firstLinkUrl`: её
 * композер кладёт в `u` поста, а карточку превью берёт у ноды
 * (`link-preview-service`).
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

/** Ссылки в тексте: до пробела/кавычки/скобки, без хвостовой пунктуации. */
const URL_TOKEN_RE = /(?:peertube:\/\/|https?:\/\/)[^\s"')\]]+/gi
const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]]+$/

/** Обрезает точку/запятую в конце ссылки — она принадлежит предложению, не URL. */
export function trimUrlPunctuation(url: string): string {
  return url.replace(TRAILING_PUNCTUATION_RE, '')
}

/** Извлекает 11-символьный YouTube video ID (watch?v=, youtu.be/, /embed/, /shorts/, /live/). */
export function extractYoutubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  return m ? m[1]! : null
}

/** Извлекает числовой Vimeo video ID (vimeo.com/123456789). */
export function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/)
  return m ? m[1]! : null
}

/** Разбирает одиночную ссылку в ParsedVideo. */
export function parseVideoUrl(url: string): ParsedVideo {
  const trimmed = trimUrlPunctuation((url || '').trim())
  if (!trimmed) return { kind: null, url: '' }

  const pt = parsePeerTubeUrl(trimmed)
  if (pt) {
    return { kind: pt.type === 'audio' ? 'audio' : 'peertube', url: trimmed }
  }

  const yt = extractYoutubeId(trimmed)
  if (yt) {
    return { kind: 'youtube', url: trimmed, embedUrl: youtubeEmbedUrl(yt) }
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
  const tokens = text.match(URL_TOKEN_RE) || []
  for (const token of tokens) {
    const clean = trimUrlPunctuation(token)
    if (parseVideoUrl(clean).kind) return clean
  }
  return ''
}

/** Ссылка на картинку по расширению пути: такие старый клиент в `u` не кладёт. */
const IMAGE_PATH_RE = /\.(?:jpe?g|png|gif|webp|avif|jfif|bmp|svg)$/i

export function isImageUrl(url: string): boolean {
  try {
    return IMAGE_PATH_RE.test(new URL(url).pathname)
  } catch {
    return false
  }
}

/**
 * Первая обычная веб-ссылка в тексте: http(s), не видео и не картинка. Как
 * `linksFromText` старого клиента, композер кладёт её в `u` поста, и под
 * постом появляется карточка с заголовком и картинкой страницы.
 */
export function firstLinkUrl(text: string): string {
  if (!text) return ''
  const tokens = text.match(URL_TOKEN_RE) || []
  for (const token of tokens) {
    const clean = trimUrlPunctuation(token)
    if (!/^https?:\/\/[^/]+\.[^/]+/i.test(clean)) continue
    if (parseVideoUrl(clean).kind || isImageUrl(clean)) continue
    return clean
  }
  return ''
}

/** Канонический embed-URL YouTube по id. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}`
}

/**
 * Уникальные YouTube-embed'ы из текста поста (или JSON-контента).
 * Использует тот же экстрактор, что и композер, — раньше лента не видела
 * `shorts/` и `embed/`.
 */
export function getYoutubeEmbedUrls(content: string | undefined): string[] {
  if (!content || typeof content !== 'string') return []
  const ids = new Set<string>()
  for (const token of content.match(URL_TOKEN_RE) || []) {
    const id = extractYoutubeId(trimUrlPunctuation(token))
    if (id) ids.add(id)
  }
  return Array.from(ids).map(youtubeEmbedUrl)
}

/** Ролик, который встраивается iframe'ом прямо в пост. */
export interface VideoEmbed {
  kind: 'youtube' | 'vimeo'
  id: string
  /** Адрес для iframe. */
  embedUrl: string
  /** Страница ролика на самой площадке. */
  watchUrl: string
}

/**
 * YouTube и Vimeo для встраивания — из ссылки поста (`u`) и его текста, без
 * повторов. Раньше лента встраивала только YouTube и только из текста: пост
 * прежнего клиента, где ссылка лежит лишь в `u`, и любой Vimeo оставались
 * без плеера, хотя композер Vimeo показывал.
 */
export function getVideoEmbeds(...sources: Array<string | undefined>): VideoEmbed[] {
  const out = new Map<string, VideoEmbed>()
  for (const source of sources) {
    if (!source || typeof source !== 'string') continue
    for (const token of source.match(URL_TOKEN_RE) || []) {
      const url = trimUrlPunctuation(token)
      const yt = extractYoutubeId(url)
      if (yt) {
        const embedUrl = youtubeEmbedUrl(yt)
        if (!out.has(embedUrl)) {
          out.set(embedUrl, {
            kind: 'youtube',
            id: yt,
            embedUrl,
            watchUrl: `https://www.youtube.com/watch?v=${yt}`,
          })
        }
        continue
      }
      const vm = extractVimeoId(url)
      if (vm) {
        const embedUrl = `https://player.vimeo.com/video/${vm}`
        if (!out.has(embedUrl)) {
          out.set(embedUrl, {
            kind: 'vimeo',
            id: vm,
            embedUrl,
            watchUrl: `https://vimeo.com/${vm}`,
          })
        }
      }
    }
  }
  return Array.from(out.values())
}

/**
 * Можно ли встроить плеер YouTube на этой странице. YouTube требует от
 * встроенного плеера заголовок Referer, а страница `tauri://localhost`
 * (приложение для macOS и Linux) его не отправляет — плеер показывает
 * «Ошибка 153». Там вместо плеера — превью со ссылкой на YouTube.
 */
export function canEmbedYoutube(protocol: string | undefined): boolean {
  return protocol === 'https:' || protocol === 'http:'
}
