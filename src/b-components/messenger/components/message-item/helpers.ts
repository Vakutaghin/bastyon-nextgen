// Хелперы компонента message-item: форматирование текста, позиционирование

import { escapeHtml } from '@/helpers/common/html-escape'

import { MESSAGE_URL_PATTERN } from './consts'
import { BASTYON_LINK_RE, parseBasytonLink, type BastyonLinkTarget } from '../../lib/bastyon-link'

/** Базовые проверки безопасности URL: только http(s), без javascript:/data:/blob:. */
const isSafeHttpUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Форматирует текст сообщения: экранирует HTML и оборачивает URL в ссылки.
 */
export function formatMessageText(text: string): string {
  const parts = text.split(MESSAGE_URL_PATTERN)

  return parts
    .map((part) => {
      if (part.match(MESSAGE_URL_PATTERN)) {
        const escapedHref = escapeHtml(part)
        return `<a href="${escapedHref}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none;">${escapedHref}</a>`
      }
      return escapeHtml(part)
    })
    .join('')
}

/**
 * Сегмент текста сообщения: либо обычный текст (HTML-экранированный, с URL-ссылками),
 * либо распарсенная Бастион-ссылка под inline-embed.
 */
export type MessageSegment =
  | { kind: 'html'; html: string }
  | { kind: 'bastyon'; target: BastyonLinkTarget; raw: string }

/**
 * Разбивает текст сообщения на сегменты:
 *  - сначала находим Бастион-ссылки (post/index/comment) и заменяем их segment-ами
 *    типа 'bastyon' для последующего рендера через <PostEmbed>;
 *  - оставшийся текст обрабатываем как обычный (URL → <a>, остальное — escape).
 *
 * Если bastyon-ссылок несколько — все попадают как embed-сегменты в исходном порядке.
 */
export function formatMessageSegments(text: string): MessageSegment[] {
  if (!text) return []

  // Найти все Bastyon-ссылки и их позиции
  BASTYON_LINK_RE.lastIndex = 0
  const matches: Array<{ start: number; end: number; raw: string; target: BastyonLinkTarget }> = []
  let m: RegExpExecArray | null
  while ((m = BASTYON_LINK_RE.exec(text)) !== null) {
    const raw = m[0]
    const target = parseBasytonLink(raw)
    if (target) {
      matches.push({ start: m.index, end: m.index + raw.length, raw, target })
    }
  }

  if (matches.length === 0) {
    return [{ kind: 'html', html: formatMessageText(text) }]
  }

  // Сшиваем сегменты: куски обычного текста чередуются с bastyon-embed
  const segments: MessageSegment[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.start > cursor) {
      const chunk = text.slice(cursor, match.start)
      if (chunk) segments.push({ kind: 'html', html: formatMessageText(chunk) })
    }
    segments.push({ kind: 'bastyon', target: match.target, raw: match.raw })
    cursor = match.end
  }
  if (cursor < text.length) {
    const tail = text.slice(cursor)
    if (tail) segments.push({ kind: 'html', html: formatMessageText(tail) })
  }
  return segments
}

/**
 * Извлекает первую внешнюю http(s) ссылку из текста, исключая Bastyon-линки
 * (для них уже рендерится PostEmbed). Возвращает null, если ничего нет.
 *
 * Берём ровно одну ссылку — иначе чат разрастается. Если пользователь
 * прислал несколько URL — превью получает только первая.
 */
export function extractFirstExternalUrl(text: string): string | null {
  if (!text) return null

  // Сначала соберём набор позиций бастион-ссылок, чтобы исключить их из общего поиска.
  BASTYON_LINK_RE.lastIndex = 0
  const bastyonRanges: Array<[number, number]> = []
  let bm: RegExpExecArray | null
  while ((bm = BASTYON_LINK_RE.exec(text)) !== null) {
    bastyonRanges.push([bm.index, bm.index + bm[0].length])
  }
  const inBastyon = (pos: number): boolean =>
    bastyonRanges.some(([start, end]) => pos >= start && pos < end)

  MESSAGE_URL_PATTERN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MESSAGE_URL_PATTERN.exec(text)) !== null) {
    if (inBastyon(m.index)) continue
    const raw = m[0]!.replace(/[.,;:!?)>\]]+$/, '') // обрезаем хвостовые знаки препинания
    if (raw.startsWith('bastyon://')) continue
    if (isSafeHttpUrl(raw)) return raw
  }
  return null
}

/**
 * Форматирует время сообщения: «08:23» или «23.01.2023, 08:23» если год другой.
 */
export function formatMessageTime(timestamp: number): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const now = new Date()
  const timePart = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (
    d.getFullYear() !== now.getFullYear() ||
    d.getMonth() !== now.getMonth() ||
    d.getDate() !== now.getDate()
  ) {
    const datePart = d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    return `${datePart}, ${timePart}`
  }

  return timePart
}

/**
 * Находит ближайшего прокручиваемого предка элемента.
 */
export function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null
  while (p) {
    const ov = getComputedStyle(p).overflowY
    if ((ov === 'auto' || ov === 'scroll' || ov === 'overlay') && p.scrollHeight > p.clientHeight) {
      return p
    }
    p = p.parentElement
  }
  return null
}
