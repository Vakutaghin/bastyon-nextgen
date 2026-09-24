/**
 * Разбор клика по ссылке внутри пользовательского контента (v-html постов,
 * комментариев, сообщений).
 *
 * Зачем: в разметке живут три вида ссылок, и браузеру ни одну из них нельзя
 * отдать как есть:
 *  - `@меншен` (`a.mention-link`) — внутренний путь, иначе будет полная
 *    перезагрузка SPA;
 *  - `bastyon://post?s=…` — рендерилась как «внутренняя», но клик никто не
 *    обрабатывал: в вебе ничего, в Tauri webview уходил на неизвестную схему
 *    (N15);
 *  - внешняя `https://…` с `target="_blank"` — в десктопной сборке no-op
 *    (V40), её нужно открыть системным браузером.
 *
 * Функция чистая: DOM и роутер — на стороне вызывающего.
 */

import { parseBasytonLink } from '@/b-components/messenger/lib/bastyon-link'

export type ContentLinkAction =
  /** Внутренняя навигация роутером. */
  | { kind: 'router'; path: string }
  /** Открыть снаружи (системный браузер / новая вкладка). */
  | { kind: 'external'; href: string }
  /** Ничего не делаем — пусть решает браузер. */
  | { kind: 'none' }

export interface ContentLinkContext {
  /** Класс якоря — по нему узнаём меншены. */
  className?: string
  /** В Tauri внешние ссылки обязаны идти через opener (V40). */
  isTauri: boolean
  /** Origin приложения — ссылки на себя внешними не считаем. */
  origin: string
}

/** Маршрут поста по разобранной `bastyon://`-ссылке. */
function postPath(txid: string, commentId?: string): string {
  return commentId ? `/post/${txid}?commentid=${commentId}` : `/post/${txid}`
}

export function classifyContentLink(href: string, ctx: ContentLinkContext): ContentLinkAction {
  const raw = (href ?? '').trim()
  if (!raw) return { kind: 'none' }

  // Меншен — внутренний путь `/<ник>`.
  if (ctx.className?.split(/\s+/).includes('mention-link')) {
    return raw.startsWith('/') ? { kind: 'router', path: raw } : { kind: 'none' }
  }

  if (/^bastyon:\/\//i.test(raw)) {
    const target = parseBasytonLink(raw)
    // Неразобранную bastyon-ссылку никуда не ведём: в Tauri навигация на
    // неизвестную схему выкидывает webview из приложения.
    if (!target) return { kind: 'router', path: '/' }
    return { kind: 'router', path: postPath(target.txid, target.commentId) }
  }

  let parsed: URL
  try {
    parsed = new URL(raw, ctx.origin)
  } catch {
    return { kind: 'none' }
  }

  // Ссылка на само приложение — обычная внутренняя навигация (её делает <a>).
  if (parsed.origin === ctx.origin) return { kind: 'none' }

  if (
    parsed.protocol === 'http:' ||
    parsed.protocol === 'https:' ||
    parsed.protocol === 'mailto:'
  ) {
    // В вебе `target="_blank"` работает сам; перехватываем только там, где нет.
    return ctx.isTauri ? { kind: 'external', href: parsed.href } : { kind: 'none' }
  }

  return { kind: 'none' }
}
