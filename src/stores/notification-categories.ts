// Разделы окна уведомлений: по ним фильтрует ряд «Все · Комментарии ·
// Оценки · …». Чистая функция — раздел решается по типу события, без
// компонентов. Что не попало ни в один раздел (упоминания, обновления
// профиля), видно только во «Все».

import { isReplyableNotification } from './notification-target'
import type { NotificationItem } from './notifications-types'

export type NotificationCategory = 'comments' | 'ratings' | 'subscribers' | 'coins' | 'posts'

/** Порядок разделов в ряду фильтров. */
export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  'comments',
  'ratings',
  'subscribers',
  'coins',
  'posts',
]

export function notificationCategory(item: NotificationItem): NotificationCategory | null {
  // Комментарии — те, на которые можно ответить: комментарий к посту и ответ вам.
  if (isReplyableNotification(item)) return 'comments'
  switch (item.mesType) {
    case 'upvoteShare':
    case 'upvoteComment':
      return 'ratings'
    case 'subscribe':
    case 'subscribePrivate':
    case 'unsubscribe':
      return 'subscribers'
    case 'transaction':
    case 'donation':
    case 'paidSubscription':
    case 'win':
      return 'coins'
    case 'repost':
    case 'boost':
    case 'postfromprivate':
      return 'posts'
    default:
      break
  }
  switch (item.type) {
    case 'rating':
    case 'like':
      return 'ratings'
    case 'subscribe':
      return 'subscribers'
    case 'tip':
      return 'coins'
    case 'repost':
      return 'posts'
    default:
      return null
  }
}

/** Сколько уведомлений в каждом разделе. */
export function countByCategory(
  items: readonly NotificationItem[]
): Record<NotificationCategory, number> {
  const counts: Record<NotificationCategory, number> = {
    comments: 0,
    ratings: 0,
    subscribers: 0,
    coins: 0,
    posts: 0,
  }
  for (const item of items) {
    const category = notificationCategory(item)
    if (category) counts[category] += 1
  }
  return counts
}
