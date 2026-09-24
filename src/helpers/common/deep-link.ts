/**
 * Разбор внешней ссылки (`bastyon://…`, `https://bastyon.com/…`) во внутренний
 * маршрут приложения.
 *
 * Одна функция на все платформы: системная ссылка приходит по-разному —
 * `onOpenUrl` в Tauri, `appUrlOpen` в Capacitor, `?deeplink=` у PWA, — но
 * дальше все ведут себя одинаково.
 *
 * Формы ссылок взяты из legacy (`js/satolist.js`: схема/хост срезаются, а
 * остаток — обычный маршрут приложения), поэтому старые ссылки из постов,
 * чатов и рассылок продолжают работать:
 *   bastyon://post?s=<txid>[&c=<commentTxid>]   — пост (и комментарий)
 *   bastyon://index?v=<txid>                    — видео-пост
 *   bastyon://application?id=<appId>[&p=<hex>]  — мини-приложение
 *   bastyon://<ник или адрес>                   — профиль
 */

import { parseBasytonLink } from '@/b-components/messenger/lib/bastyon-link'

/** Хосты, ссылки на которые считаем своими. */
const APP_HOSTS = new Set([
  'bastyon.com',
  'www.bastyon.com',
  'test.bastyon.com',
  'pocketnet.app',
  'www.pocketnet.app',
  'test.pocketnet.app',
])

/** Схемы приложения. `web+bastyon` — единственное, что разрешают браузеры PWA. */
const APP_SCHEMES = ['bastyon:', 'pocketnet:', 'web+bastyon:']

const HEX64_RE = /^[a-f0-9]{64}$/i
/** Ник профиля: как в маршруте `/:userName`. */
const NICKNAME_RE = /^[A-Za-z0-9_.-]{2,64}$/

/** Legacy кодирует вложенный путь мини-аппы hex'ом (`hexEncode`). */
function decodeHexPath(value: string): string {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return ''
  let out = ''
  for (let i = 0; i < value.length; i += 2) {
    out += String.fromCharCode(Number.parseInt(value.slice(i, i + 2), 16))
  }
  try {
    return decodeURIComponent(escape(out))
  } catch {
    return out
  }
}

/** Приводит ссылку к `URL`, понимая и схему приложения, и https-хосты. */
function parseAppUrl(raw: string): URL | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()
  const scheme = APP_SCHEMES.find((s) => lower.startsWith(s))
  if (scheme) {
    // `bastyon://post?s=…` — «хост» здесь на самом деле имя маршрута, поэтому
    // подставляем фиктивный origin и разбираем остаток как путь.
    const rest = trimmed.slice(scheme.length).replace(/^\/+/, '')
    try {
      return new URL(`https://app.local/${rest}`)
    } catch {
      return null
    }
  }

  try {
    const url = new URL(trimmed)
    if (!APP_HOSTS.has(url.hostname.toLowerCase())) return null
    return url
  } catch {
    return null
  }
}

/** Маршрут поста с опциональным якорем на комментарий. */
function postRoute(txid: string, commentId?: string): string {
  return commentId ? `/post/${txid}?commentid=${commentId}` : `/post/${txid}`
}

/**
 * Внутренний маршрут для внешней ссылки. `null` — ссылка не наша (или
 * бессмысленная), тогда вызывающий ничего не делает.
 */
export function resolveDeepLink(rawUrl: string): string | null {
  const url = parseAppUrl(rawUrl)
  if (!url) return null

  // Пост/видео — общий парсер с in-app ссылками (`bastyon-link`).
  const post = parseBasytonLink(rawUrl)
  if (post) return postRoute(post.txid, post.commentId)

  const segments = url.pathname.split('/').filter(Boolean)
  const head = (segments[0] ?? '').toLowerCase()
  const params = url.searchParams

  // Мини-приложение: legacy `application?id=<appId>&p=<hex-путь>`.
  if (head === 'application' || head === 'app') {
    const appId = params.get('id') || segments[1] || ''
    if (!appId) return '/'
    const innerPath = decodeHexPath(params.get('p') ?? '').replace(/^\/+/, '')
    const base = `/app/${encodeURIComponent(appId)}`
    return innerPath ? `${base}/${innerPath}` : base
  }

  // Профиль: `profile?address=…` либо просто `bastyon://<ник>`.
  if (head === 'profile' || head === 'user') {
    const address = params.get('address') || params.get('id') || segments[1] || ''
    return address ? `/${address}` : '/'
  }

  if (head === 'post' || head === 'index') {
    // Дошли сюда — значит txid не распознан (битая ссылка): открываем ленту,
    // а не «страницу поста» с мусорным id.
    const txid = params.get('s') || params.get('v') || ''
    return HEX64_RE.test(txid) ? postRoute(txid.toLowerCase()) : '/'
  }

  // Известные разделы приложения отдаём как есть.
  const KNOWN_SECTIONS = new Set([
    'search',
    'settings',
    'wallets',
    'limits',
    'miniapps',
    'explorer',
    'my-videos',
    'compose',
    'info',
  ])
  if (KNOWN_SECTIONS.has(head)) {
    return url.pathname + url.search
  }

  // Остаток — ник или адрес профиля (`bastyon://alice`).
  if (segments.length === 1 && NICKNAME_RE.test(segments[0]!)) {
    return `/${segments[0]}`
  }

  return segments.length === 0 ? '/' : null
}
