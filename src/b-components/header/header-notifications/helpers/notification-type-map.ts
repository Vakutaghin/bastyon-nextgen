// Маппинг тип-уведомления → иконка/русская подпись.
// Используется для отрисовки бейджей и кратких меток в дропдауне.

import type { NotificationItem } from '@/stores/notifications-store'

/** Имя ant-design-icon-компонента для каждого типа уведомления. */
export const ICON_BY_TYPE: Record<string, string> = {
  rating: 'StarFilled',
  like: 'StarFilled',
  comment: 'MessageOutlined',
  subscribe: 'UserAddOutlined',
  repost: 'RetweetOutlined',
  tip: 'DollarOutlined',
  mention: 'NotificationOutlined',
  other: 'EditOutlined',
}

/**
 * Короткая русская метка типа — для цветной плашки рядом с записью.
 * Для answer/post различаем подтипы (mesType), чтобы пользователь сразу видел
 * «это ответ на мой коммент» vs «это просто новый коммент».
 */
export function notificationTypeLabel(item: NotificationItem): string {
  switch (item.mesType) {
    case 'upvoteShare':
      return item.upvoteVal != null && item.upvoteVal < 0 ? 'Низкая оценка' : 'Оценка'
    case 'comment':
      return 'Комментарий'
    case 'answer':
      return 'Ответ'
    case 'subscribe':
      return 'Подписка'
    case 'subscribePrivate':
      return 'Приватная подписка'
    case 'unsubscribe':
      return 'Отписка'
    case 'repost':
      return 'Репост'
    case 'post':
      return 'Новый пост'
    case 'userInfo':
      return 'Профиль обновлён'
    default:
      break
  }
  switch (item.type) {
    case 'rating':
    case 'like':
      return 'Оценка'
    case 'comment':
      return 'Комментарий'
    case 'subscribe':
      return 'Подписка'
    case 'repost':
      return 'Репост'
    case 'tip':
      return 'Донат'
    case 'mention':
      return 'Упоминание'
    default:
      return 'Уведомление'
  }
}
