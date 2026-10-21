// Что окно просмотра IPFS (узел в браузере) показывает само, а что предлагает
// скачать. Показывается уже проверенный файл из памяти (Blob), поэтому у
// картинок, звука и видео есть потолок размера. Текст показывается всегда, но
// только начало: он выводится как текст, а не страница.
//
// HTML здесь тоже текст. Чужой HTML нельзя открывать на origin приложения, а
// сайты открываются в браузере через inbrowser.link.

export type PreviewKind = 'image' | 'video' | 'audio' | 'text'

/** Картинки, которые показывает любой движок. SVG в <img> скриптов не выполняет. */
const IMAGE = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/x-icon',
  'image/svg+xml',
])
const VIDEO = new Set(['video/mp4', 'video/webm'])
const AUDIO = new Set(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/flac'])
const TEXT_EXACT = new Set(['application/json'])

/** Потолок размера для показа; больше — только скачать. */
export const PREVIEW_MAX_BYTES: Record<Exclude<PreviewKind, 'text'>, number> = {
  image: 50 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 200 * 1024 * 1024,
}

/** Сколько первых байт текста показывается. */
export const TEXT_PREVIEW_BYTES = 256 * 1024

/** Движок Apple (Safari, WKWebView): он один играет MOV и HEIC. */
function isAppleWebKit(userAgent: string): boolean {
  return /AppleWebKit/i.test(userAgent) && !/Chrome|Chromium|Android/i.test(userAgent)
}

/** Как показать файл этого типа; null — никак, только скачать. */
export function previewKind(type: string, userAgent: string): PreviewKind | null {
  const t = (type.split(';')[0] ?? '').trim().toLowerCase()
  if (IMAGE.has(t)) return 'image'
  if (t === 'image/heic') return isAppleWebKit(userAgent) ? 'image' : null
  if (VIDEO.has(t)) return 'video'
  if (t === 'video/quicktime') return isAppleWebKit(userAgent) ? 'video' : null
  if (AUDIO.has(t)) return 'audio'
  if (t.startsWith('text/') || TEXT_EXACT.has(t)) return 'text'
  return null
}

/** Показать файл в окне: тип подходит и файл не больше потолка. */
export function canPreview(type: string, size: number, userAgent: string): PreviewKind | null {
  const kind = previewKind(type, userAgent)
  if (!kind) return null
  if (kind === 'text') return kind
  return size <= PREVIEW_MAX_BYTES[kind] ? kind : null
}
