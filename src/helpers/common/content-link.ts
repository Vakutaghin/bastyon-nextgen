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

import { resolveDeepLink } from '@/helpers/common/deep-link'

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

export function classifyContentLink(href: string, ctx: ContentLinkContext): ContentLinkAction {
  const raw = (href ?? '').trim()
  if (!raw) return { kind: 'none' }

  // Меншен — внутренний путь `/<ник>`.
  if (ctx.className?.split(/\s+/).includes('mention-link')) {
    return raw.startsWith('/') ? { kind: 'router', path: raw } : { kind: 'none' }
  }

  if (/^bastyon:\/\/|^pocketnet:\/\//i.test(raw)) {
    // Тот же разбор, что у системных ссылок (deep links), — клик по ссылке в
    // посте и клик по ней же в почте ведут в одно место.
    const path = resolveDeepLink(raw)
    // Неразобранную ссылку никуда не ведём: в Tauri навигация на неизвестную
    // схему выкидывает webview из приложения.
    return { kind: 'router', path: path ?? '/' }
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
