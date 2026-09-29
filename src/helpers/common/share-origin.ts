/**
 * Публичный origin для ссылок, которые уходят наружу (поделиться постом,
 * копировать ссылку на комментарий, embed-код, og:url).
 *
 * `window.location.origin` для этого не годится: в десктопной сборке он
 * `tauri://localhost`, в мобильной — `https://localhost`, и такую ссылку
 * получатель открыть не может (S20). В браузере остаёмся на текущем origin —
 * это и есть публичный адрес, на котором открыт клиент.
 */

import { UPDATE_REPO } from '@/helpers/updates/github-release'

/** Публичный веб-адрес сети — туда ведут ссылки из десктопа и мобильного. */
export const PUBLIC_WEB_ORIGIN = 'https://bastyon.com'

/** Справка приложения в открытом репозитории: GitHub показывает её как есть. */
export const HELP_SOURCE_URL = `https://github.com/${UPDATE_REPO}/blob/main/help`

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

/**
 * Путь к посту на данном origin. На bastyon.com работает прежний веб-клиент,
 * и он понимает только свои адреса `post?s=<txid>`: путь `/post/<txid>` там
 * отвечает 404 — ссылки из десктопа и телефона у получателя не открывались.
 * Веб-сборка этого приложения (любой другой origin) знает `/post/<txid>`.
 */
function postPath(origin: string, postId: string, extra?: URLSearchParams): string {
  if (origin === PUBLIC_WEB_ORIGIN) {
    const params = new URLSearchParams({ s: postId })
    extra?.forEach((value, key) => params.set(key, value))
    return `${origin}/post?${params.toString()}`
  }
  const query = extra?.toString()
  return `${origin}/post/${postId}${query ? `?${query}` : ''}`
}

/** Ссылка на пост, пригодная для отправки другому человеку. */
export function publicPostUrl(postId: string): string {
  return postPath(publicShareOrigin(), postId)
}

/**
 * Ссылка на комментарий под постом: `commentid`, у ответа ещё `parentid` —
 * этот формат понимают и прежний клиент, и `/post/:txid` этого приложения.
 */
export function commentUrl(
  origin: string,
  postId: string,
  comment: { id: string; parentid?: string | null }
): string {
  const params = new URLSearchParams({ commentid: comment.id })
  if (comment.parentid && comment.parentid !== comment.id) params.set('parentid', comment.parentid)
  return postPath(origin, postId, params)
}

/**
 * Кодирование параметров виджета прежнего клиента (`hexEncode` из
 * functionsfirst.js): байт на символ, кириллица сдвинута в однобайтовый диапазон.
 */
function legacyHexEncode(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i)
    if (code > 0xff) code -= 0x350
    out += code.toString(16).padStart(2, '0')
  }
  return out
}

/**
 * Код для вставки поста на свой сайт. На bastyon.com своей страницы вставки
 * нет, зато есть виджет прежнего клиента `js/widgets.js` — код тот же, что
 * даёт его меню «Поделиться» (socialshare2 embeddingcode). Веб-сборка этого
 * приложения отдаёт iframe со страницей `/embed/post/<txid>`.
 */
export function publicEmbedCode(postId: string): string {
  const origin = publicShareOrigin()
  if (origin === PUBLIC_WEB_ORIGIN) {
    const seed = 10000 + Math.floor(Math.random() * 90000)
    const params = legacyHexEncode(JSON.stringify({ black: false, comments: '' }))
    return (
      `<div id="pocketnet_${seed}"></div>` +
      `<script src="${origin}/js/widgets.js"></script>` +
      `<script type="text/javascript">(new window.PNWIDGETS()).make(${seed}, "lenta", "${postId}", "${params}")</script>`
    )
  }
  return (
    `<iframe src="${origin}/embed/post/${postId}" width="100%" height="640" frameborder="0" ` +
    'allow="fullscreen; picture-in-picture" loading="lazy"></iframe>'
  )
}

/**
 * Ссылка на статью справки для другого человека. Веб-сборка этого приложения
 * открывает свой `/help/<id>`; на bastyon.com справки нет, поэтому из
 * десктопа и телефона даём ту же статью в репозитории.
 */
export function publicHelpUrl(locale: 'ru' | 'en', topicId: string | null): string {
  const origin = publicShareOrigin()
  if (origin === PUBLIC_WEB_ORIGIN) return `${HELP_SOURCE_URL}/${locale}/${topicId ?? 'README'}.md`
  return topicId ? `${origin}/help/${topicId}` : `${origin}/help`
}
