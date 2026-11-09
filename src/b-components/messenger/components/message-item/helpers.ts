// Хелперы компонента message-item: форматирование текста, позиционирование

import { escapeHtml } from '@/helpers/common/html-escape'

import { MESSAGE_URL_PATTERN } from './consts'
import { BASTYON_LINK_RE, parseBasytonLink, type BastyonLinkTarget } from '../../lib/bastyon-link'
import { ENTITY_LINK_RE, entityOfMatch, type EntityLinkTarget } from '../../lib/entity-link'

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
        return `<a href="${escapedHref}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline; text-underline-offset: 2px;">${escapedHref}</a>`
      }
      return escapeHtml(part)
    })
    .join('')
}

/**
 * Убирает пустые строки в начале и в конце сообщения: другие клиенты
 * отправляют текст как есть, и под `white-space: pre-wrap` они раздувают
 * пузырь. Отступ первой непустой строки и переносы внутри текста остаются.
 * Хвост — без регулярки: `\n\s*$` на чужом тексте из тысяч переносов
 * работает за квадрат.
 */
export function trimBlankLines(text: string): string {
  const start = /^\s*\n/.exec(text)?.[0].length ?? 0
  const body = text.trimEnd().length
  const tailBreak = text.indexOf('\n', body)
  return text.slice(start, tailBreak === -1 ? text.length : tailBreak)
}

/**
 * Сегмент текста сообщения: либо обычный текст (HTML-экранированный, с URL-ссылками),
 * либо распарсенная Бастион-ссылка под inline-embed.
 */
export type MessageSegment =
  | { kind: 'html'; html: string }
  | { kind: 'bastyon'; target: BastyonLinkTarget; raw: string }
  /** Ссылка на профиль или коллекцию (lib/entity-link) — карточкой. */
  | { kind: 'entity'; target: EntityLinkTarget; raw: string }

type EmbedSegment = Exclude<MessageSegment, { kind: 'html' }>
type EmbedMatch = { start: number; end: number; segment: EmbedSegment }

/** Ссылки, которые рисуются карточками: пост (видео, комментарий), профиль, коллекция. */
function embedMatches(text: string): EmbedMatch[] {
  const matches: EmbedMatch[] = []
  BASTYON_LINK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = BASTYON_LINK_RE.exec(text)) !== null) {
    const raw = m[0]
    const target = parseBasytonLink(raw)
    if (target) {
      matches.push({
        start: m.index,
        end: m.index + raw.length,
        segment: { kind: 'bastyon', target, raw },
      })
    }
  }
  ENTITY_LINK_RE.lastIndex = 0
  while ((m = ENTITY_LINK_RE.exec(text)) !== null) {
    const raw = m[0]
    const target = entityOfMatch(m)
    if (target) {
      matches.push({
        start: m.index,
        end: m.index + raw.length,
        segment: { kind: 'entity', target, raw },
      })
    }
  }
  return matches.sort((a, b) => a.start - b.start)
}

/**
 * Разбивает текст сообщения на сегменты:
 *  - ссылки на пост (post/index/comment) — сегменты 'bastyon' под <PostEmbed>,
 *    на профиль и коллекцию — 'entity' под их карточки;
 *  - оставшийся текст обрабатываем как обычный (URL → <a>, остальное — escape).
 *
 * Если таких ссылок несколько — все попадают как embed-сегменты в исходном порядке.
 */
export function formatMessageSegments(rawText: string): MessageSegment[] {
  const text = trimBlankLines(rawText)
  if (!text) return []

  const matches = embedMatches(text)
  if (matches.length === 0) {
    return [{ kind: 'html', html: formatMessageText(text) }]
  }

  // Сшиваем сегменты: куски обычного текста чередуются с карточками
  const segments: MessageSegment[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.start < cursor) continue
    if (match.start > cursor) {
      const chunk = text.slice(cursor, match.start)
      if (chunk) segments.push({ kind: 'html', html: formatMessageText(chunk) })
    }
    segments.push(match.segment)
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

  // Ссылки, которые и так рисуются карточками (пост, профиль, коллекция), — не превью.
  const bastyonRanges = embedMatches(text).map(({ start, end }) => [start, end] as const)
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
