// Хелперы блока комментариев: форматирование, сортировка, утилиты

import type { GetComment } from '@/types/rpc-responses/get-comments'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { resolveImageUrl } from '@/helpers/common/url-transformer'

import type { CommentsSortOrder } from './types'
import { SORT_WEIGHTS } from './consts'

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
 */
export function formatCommentDateAndTime(time: number): string {
  if (!time) return ''
  const d = new Date(time * 1000)
  const now = new Date()
  const datePart = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const yearPart = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''
  const timePart = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${datePart}${yearPart}, ${timePart}`
}

// --- Алгоритм сортировки «интересные» ---

/**
 * Вычисляет рейтинг комментария для сортировки «интересные».
 * Учитывает лайки, количество ответов, длину текста, репутацию автора.
 */
export function commentPoint(comment: GetComment): number {
  const W = SORT_WEIGHTS
  let p = 0
  const msgLen = getCommentMessageText(comment).length
  const rep = comment.reputation ?? 0

  p += comment.scoreUp * W.SCORE_UP
  p += comment.children * W.CHILDREN

  if (comment.scoreUp > comment.scoreDown) {
    p += comment.scoreDown * W.SCORE_DOWN_POSITIVE
  } else {
    p -= comment.scoreDown * W.SCORE_DOWN_NEGATIVE
  }

  p += Math.min(msgLen, W.MESSAGE_LENGTH_MAX) * W.MESSAGE_LENGTH_MULTIPLIER
  p += Math.max(rep, W.REPUTATION_BASE) * W.REPUTATION_MULTIPLIER + rep / W.REPUTATION_DIVISOR

  if (comment.deleted) p = p / W.DELETED_DIVISOR

  return p
}

/**
 * Сортирует комментарии по указанному порядку.
 */
export function sortComments(comments: GetComment[], order: CommentsSortOrder): GetComment[] {
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
    const scoreA = -(commentPoint(a) + timecA * SORT_WEIGHTS.TIME_BONUS) / countA
    const scoreB = -(commentPoint(b) + timecB * SORT_WEIGHTS.TIME_BONUS) / countB
    return scoreA - scoreB
  })
}
