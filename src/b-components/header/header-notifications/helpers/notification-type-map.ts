// Маппинг тип-уведомления → иконка/i18n-ключ подписи.
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
 * i18n-ключ короткой метки типа — для цветной плашки рядом с записью.
 * Для answer/post различаем подтипы (mesType), чтобы пользователь сразу видел
 * «это ответ на мой коммент» vs «это просто новый коммент».
 * Резолвится через t() в компоненте при рендере (реактивно к смене языка).
 */
export function notificationTypeLabelKey(item: NotificationItem): string {
  switch (item.mesType) {
    case 'upvoteShare':
      return item.upvoteVal != null && item.upvoteVal < 0
        ? 'notif.typeLowRating'
        : 'notif.typeRating'
    case 'comment':
      return 'notif.typeComment'
    case 'answer':
      return 'notif.typeAnswer'
    case 'subscribe':
      return 'notif.typeSubscribe'
    case 'subscribePrivate':
      return 'notif.typeSubscribePrivate'
    case 'unsubscribe':
      return 'notif.typeUnsubscribe'
    case 'repost':
      return 'notif.typeRepost'
    case 'post':
      return 'notif.typePost'
    case 'userInfo':
      return 'notif.typeUserInfo'
    default:
      break
  }
  switch (item.type) {
    case 'rating':
    case 'like':
      return 'notif.typeRating'
    case 'comment':
      return 'notif.typeComment'
    case 'subscribe':
      return 'notif.typeSubscribe'
    case 'repost':
      return 'notif.typeRepost'
    case 'tip':
      return 'notif.typeTip'
    case 'mention':
      return 'notif.typeMention'
    default:
      return 'notif.typeDefault'
  }
}
