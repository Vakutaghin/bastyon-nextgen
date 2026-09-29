/**
 * Фильтрация уведомлений по настройкам пользователя и порог «низкой оценки».
 *
 * Один модуль на все три точки показа — тосты, список в шапке и браузерные
 * уведомления. Раньше фильтры жили только в тостах: тумблеры в настройках
 * («Победы», «Транзакции», «Оценки комментариев») не влияли ни на список, ни
 * на системные уведомления (S56).
 *
 * Порог оценки: у ноды `upvoteVal` — это звёзды 1..5, а не знак. Legacy
 * считает низкой оценкой `<= 2` (`satolist.js`: `data.upvoteVal > 2` —
 * позитив), у нас же в двух местах стояло `< 0`, из-за чего 1★ показывалась
 * как похвала, а заголовок «низкая оценка» был недостижим (S57).
 */

import type { NotificationItem } from './notifications-types'

/** Максимальная оценка (в звёздах), которая считается низкой. */
export const LOW_RATING_MAX_VAL = 2

/** Низкая ли оценка (1★–2★). Для событий без оценки — false. */
export function isLowRatingValue(upvoteVal: number | null | undefined): boolean {
  return upvoteVal != null && upvoteVal <= LOW_RATING_MAX_VAL
}

/** Набор тумблеров, от которых зависит показ уведомления. */
export interface NotificationFilterFlags {
  win: boolean
  transactions: boolean
  upvotes: boolean
  downvotes: boolean
  comments: boolean
  answers: boolean
  followers: boolean
  commentScore: boolean
}

/**
 * Разрешено ли уведомление настройками.
 * `mesType` — уже приведённый к именам приложения (notifications-mappers
 * canonicalMesType): comment, answer, upvoteShare, upvoteComment, subscribe,
 * subscribePrivate, unsubscribe, postfromprivate, repost, boost, transaction и
 * donation (тип `tip`) и win. Раньше здесь ждали имена, которых нода не присылает, и
 * тумблеры «Новый комментарий», «Рейтинг комментария», «Транзакция получена»
 * и «Coinstake выигрыш» ни на что не влияли.
 */
export function isNotificationAllowed(
  filters: NotificationFilterFlags,
  item: Pick<NotificationItem, 'type' | 'mesType' | 'upvoteVal'>
): boolean {
  if (item.type === 'tip') return filters.transactions

  const mesType = item.mesType ?? item.type
  switch (mesType) {
    case 'comment':
      return filters.comments
    case 'answer':
      return filters.answers
    case 'upvoteShare':
      return isLowRatingValue(item.upvoteVal) ? filters.downvotes : filters.upvotes
    case 'upvoteComment':
      // Дизлайк комментария — ещё и «негативная оценка», как в старом клиенте.
      return filters.commentScore && ((item.upvoteVal ?? 0) >= 0 || filters.downvotes)
    case 'subscribe':
    case 'subscribePrivate':
      return filters.followers
    case 'unsubscribe':
      return false
    case 'transaction':
      return filters.transactions
    case 'win':
    case 'winner':
      return filters.win
    default:
      return true
  }
}
