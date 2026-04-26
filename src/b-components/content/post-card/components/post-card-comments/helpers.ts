// Хелперы блока комментариев: форматирование, сортировка, утилиты

import type { GetComment } from '@/types/rpc-responses/get-comments'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { resolveImageUrl } from '@/helpers/common/url-transformer'

import type { CommentsSortOrder } from './types'
import { SORT_WEIGHTS, COMMENT_MAX_LENGTH, COMMENT_LENGTH_WARN_THRESHOLD } from './consts'

/**
 * Возвращает текст-индикатор оставшихся символов или null, если показывать не нужно.
 * Логика 1:1 с legacy: components/comments/index.js:2270-2294 (renders.limits).
 *
 * - null  — длина в норме, индикатор скрыт
 * - {text, isOver} — показать; isOver=true если уже превышено
 */
export function getCommentLengthHint(message: string): { text: string; isOver: boolean } | null {
  const remaining = COMMENT_MAX_LENGTH - (message?.length ?? 0)
  if (remaining >= COMMENT_LENGTH_WARN_THRESHOLD) return null

  if (remaining > 0) {
    const word = remaining === 1 ? 'символ' : remaining < 5 ? 'символа' : 'символов'
    return { text: `Осталось ${remaining} ${word}`, isOver: false }
  }
  const over = -remaining
  const word = over === 1 ? 'символ' : over < 5 ? 'символа' : 'символов'
  return { text: `Превышено на ${over} ${word}`, isOver: true }
}

export function isCommentLengthValid(message: string): boolean {
  return (message?.length ?? 0) <= COMMENT_MAX_LENGTH
}

/**
 * Сжатое представление числа: 1234 → "1.2K", 1234567 → "1.2M".
 * Для значений < 1000 возвращает обычное представление.
 * Для 0 — пустую строку (как в legacy compressedNumber, где 0-счётчики
 * рендерились без подписи: `comment.scoreUp ? compressedNumber(...) : ''`).
 */
export function compressedNumber(n: number, fractionDigits = 1): string {
  if (!Number.isFinite(n) || n === 0) return ''
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs < 1000) return sign + String(abs)
  if (abs < 1_000_000) return sign + trimZero((abs / 1000).toFixed(fractionDigits)) + 'K'
  if (abs < 1_000_000_000) return sign + trimZero((abs / 1_000_000).toFixed(fractionDigits)) + 'M'
  return sign + trimZero((abs / 1_000_000_000).toFixed(fractionDigits)) + 'B'
}

function trimZero(s: string): string {
  // "1.0" → "1", "1.20" → "1.2"
  if (!s.includes('.')) return s
  return s.replace(/\.?0+$/, '')
}

/** Состояние транзакции комментария */
export type CommentTxState = 'normal' | 'pending' | 'rejected'

/**
 * Определяет статус TX комментария.
 *   - 'rejected' — TX отклонена сетью
 *   - 'pending'  — TX в mempool / ждёт релэя
 *   - 'normal'   — подтверждена
 *
 * Поля comment.temp/relay/rejected приходят НЕ из getcomments (там их нет),
 * а проставляются клиентским mempool-слоем при отправке транзакции.
 * До интеграции этого слоя (Phase 2) функция вернёт 'normal' для всех живых комментов.
 */
export function getCommentTxState(comment: GetComment): CommentTxState {
  if (comment.rejected) return 'rejected'
  if (comment.temp || comment.relay) return 'pending'
  return 'normal'
}

/**
 * Извлекает текст сообщения из комментария.
 * Поле msg может быть JSON-строкой с полем message или просто текстом.
 */
export function getCommentMessageText(comment: GetComment): string {
  try {
    const parsed = JSON.parse(comment.msg) as { message?: string }
    return parsed?.message ?? comment.msg
  } catch {
    return comment.msg
  }
}

/**
 * Извлекает массив URL/хэшей картинок из comment.msg (JSON-форма).
 * Каждый элемент прогоняется через resolveImageUrl для корректного отображения.
 * Возвращает пустой массив если картинок нет или msg не парсится.
 */
export function getCommentImages(comment: GetComment): string[] {
  try {
    const parsed = JSON.parse(comment.msg) as { images?: unknown }
    const arr = parsed?.images
    if (!Array.isArray(arr) || arr.length === 0) return []
    const out: string[] = []
    for (const raw of arr) {
      if (typeof raw !== 'string' || !raw) continue
      // legacy кодировал картинки через encodeURIComponent — попробуем декодировать
      let decoded = raw
      try { decoded = decodeURIComponent(raw) } catch { /* keep raw */ }
      const resolved = resolveImageUrl(decoded)
      if (resolved) out.push(resolved)
    }
    return out
  } catch {
    return []
  }
}

/**
 * Форматирует текст комментария в HTML с кликабельными ссылками.
 */
export function formatCommentMessageHtml(comment: GetComment): string {
  return formatBastyonLinks(getCommentMessageText(comment))
}

/**
 * Резолвит URL аватара из профиля комментатора.
 */
export function getCommentAvatarUrl(profile: GetComment['userprofile']): string | null {
  const i = profile?.i
  if (!i) return null
  return resolveImageUrl(i) || null
}

/**
 * Формирует ссылку на профиль комментатора.
 */
export function getCommentProfileLink(comment: GetComment): string {
  const name = (comment.userprofile?.name || '').toLowerCase()
  const address = comment.address || ''
  if (address) return '/' + address
  if (name) return '/' + name
  return '/'
}

/**
 * Извлекает первую букву имени для аватара-инициала.
 */
export function getInitial(nameOrLetter?: string): string {
  if (!nameOrLetter) return '?'
  if (nameOrLetter.length === 1) return nameOrLetter.toUpperCase()
  return nameOrLetter.charAt(0).toUpperCase()
}

/**
 * Форматирует дату и время комментария:
 * «23 января, 08:23» или «23 января 2023, 08:23» (если год отличается).
 *
 * Делегирует в централизованную утилиту formatDateTimeFull.
 */
export { formatDateTimeFull as formatCommentDateAndTime } from '@/helpers/common/date-formatter'

// --- Алгоритм сортировки «интересные» ---

/**
 * Сумма доната к комментарию в PKOIN. Поле `amount` приходит в satoshi (×1e8) и
 * присутствует только если у комментария есть прикреплённый donate.
 */
function getCommentDonateAmount(comment: GetComment): number {
  const raw = (comment as GetComment & { amount?: number }).amount
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 0
  return raw / 100000000
}

/**
 * Контекст для алгоритма «interesting»: то, что не достаётся прямо из comment.
 * Любое поле опционально — отсутствие фактора просто не штрафует и не бустит.
 */
export interface CommentSortContext {
  /** Адрес текущего пользователя (для буста собственных и my-children) */
  myAddress?: string
  /** Адрес автора поста (буст для его комментариев) */
  postAuthorAddress?: string
  /** Является ли автор комментария verified — даёт максимальный буст */
  isVerified?: (address: string) => boolean
  /** Заблокирован ли автор комментария текущим пользователем — обнуляет вес */
  isBlocked?: (address: string) => boolean
  /** Очки активности пользователя (если есть): comment-point получает +activity.point*W.ACTIVITY_POINT */
  getActivityPoint?: (address: string) => number
}

/**
 * Вычисляет рейтинг комментария для сортировки «интересные».
 * Алгоритм 1:1 с legacy: components/comments/index.js:1402-1448 (commentPoint).
 */
export function commentPoint(comment: GetComment, ctx: CommentSortContext = {}): number {
  const W = SORT_WEIGHTS
  let p = 0
  const msgLen = getCommentMessageText(comment).length
  const rep = comment.reputation ?? 0
  const isMy = !!ctx.myAddress && comment.address === ctx.myAddress

  p += comment.scoreUp * W.SCORE_UP
  p += comment.children * (isMy ? W.CHILDREN_MY : W.CHILDREN)

  if (comment.scoreUp > comment.scoreDown) {
    p += comment.scoreDown * W.SCORE_DOWN_POSITIVE
  } else {
    p -= comment.scoreDown * W.SCORE_DOWN_NEGATIVE
  }

  p += Math.min(msgLen, W.MESSAGE_LENGTH_MAX) * W.MESSAGE_LENGTH_MULTIPLIER
  p += getCommentDonateAmount(comment) * W.DONATE_AMOUNT
  p += Math.max(rep, W.REPUTATION_BASE) * W.REPUTATION_MULTIPLIER + rep / W.REPUTATION_DIVISOR

  if (comment.deleted) p = p / W.DELETED_DIVISOR

  // Множители контекста (legacy: index.js:1420-1444)
  const verified = ctx.isVerified?.(comment.address) ?? false
  if (verified) {
    p = p * W.VERIFIED_BOOST
  } else if (isMy) {
    p = p * W.MY_COMMENT_BOOST
  }

  // Заблокированный автор — обнуление веса (упадёт в самый низ)
  if (!isMy && ctx.isBlocked?.(comment.address)) {
    p = 0
  }

  // Автор поста = автор комментария: дополнительный буст ×50
  if (ctx.postAuthorAddress && comment.address === ctx.postAuthorAddress) {
    p = p * W.POST_AUTHOR_BOOST
  }

  // Прибавка за активности (только для чужих, как в legacy)
  if (!isMy && ctx.getActivityPoint) {
    const ap = ctx.getActivityPoint(comment.address) || 0
    if (ap > 0) p = p + ap * W.ACTIVITY_POINT
  }

  return p
}

/**
 * Сортирует комментарии по указанному порядку.
 * Контекст влияет только на режим 'interesting' — для time-based сортировок не нужен.
 */
export function sortComments(
  comments: GetComment[],
  order: CommentsSortOrder,
  ctx: CommentSortContext = {},
): GetComment[] {
  if (!comments.length) return comments

  if (order === 'oldest') {
    return [...comments].sort((a, b) => (a.time || 0) - (b.time || 0))
  }
  if (order === 'newest') {
    return [...comments].sort((a, b) => (b.time || 0) - (a.time || 0))
  }

  // «interesting» — комбинация рейтинга, времени и уникальности автора
  const times = comments.map((c) => c.time || 0)
  const oldest = Math.min(...times)
  const newest = Math.max(...times)
  const range = newest - oldest || 1

  const byAuthor: Record<string, number> = {}
  for (const c of comments) {
    byAuthor[c.address] = (byAuthor[c.address] || 0) + 1
  }

  return [...comments].sort((a, b) => {
    const timecA = ((a.time || 0) - oldest) / range
    const timecB = ((b.time || 0) - oldest) / range
    const countA = byAuthor[a.address] || 1
    const countB = byAuthor[b.address] || 1
    const scoreA = -(commentPoint(a, ctx) + timecA * SORT_WEIGHTS.TIME_BONUS) / countA
    const scoreB = -(commentPoint(b, ctx) + timecB * SORT_WEIGHTS.TIME_BONUS) / countB
    return scoreA - scoreB
  })
}
