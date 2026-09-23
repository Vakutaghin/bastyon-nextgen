/**
 * Публичный origin для ссылок, которые уходят наружу (поделиться постом,
 * копировать ссылку на комментарий, embed-код, og:url).
 *
 * `window.location.origin` для этого не годится: в десктопной сборке он
 * `tauri://localhost`, в мобильной — `https://localhost`, и такую ссылку
 * получатель открыть не может (S20). В браузере остаёмся на текущем origin —
 * это и есть публичный адрес, на котором открыт клиент.
 */

/** Публичный веб-адрес сети — туда ведут ссылки из десктопа и мобильного. */
export const PUBLIC_WEB_ORIGIN = 'https://bastyon.com'

/** Схемы/хосты локальных оболочек: их наружу отдавать нельзя. */
function isLocalShellOrigin(origin: string): boolean {
  if (!origin) return true
  if (origin.startsWith('tauri://') || origin.startsWith('capacitor://')) return true
  if (origin.startsWith('file://')) return true
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return true
  }
}

/**
 * Origin, пригодный для внешней ссылки. В dev-сборке в браузере остаётся
 * localhost — там это осознанно (ссылка нужна для проверки вёрстки).
 */
export function publicShareOrigin(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  if (!isLocalShellOrigin(origin)) return origin
  if (import.meta.env?.DEV && origin.startsWith('http')) return origin
  return PUBLIC_WEB_ORIGIN
}

/** Ссылка на пост, пригодная для отправки другому человеку. */
export function publicPostUrl(postId: string): string {
  return `${publicShareOrigin()}/post/${postId}`
}
