// Константы стора уведомлений

/** Ключ IDB settings для хранения последнего блока */
export const NOTIFICATIONS_LAST_BLOCK_KEY = 'notificationsLastBlock'

/** Ключ IDB settings для хранения скрытых уведомлений */
export const NOTIFICATIONS_HIDDEN_IDS_KEY = 'notificationsHiddenIds'

/** Максимальное количество попыток запроса getmissedinfo */
export const MAX_RETRIES = 2

/** Задержка между повторными попытками (мс) */
export const RETRY_DELAY_MS = 2000

/** Количество уведомлений в одном запросе */
export const NOTIFICATIONS_BATCH_LIMIT = 30

/** Маппинг типов событий RPC → i18n-ключи отображаемых заголовков (домен `notif`) */
export const MESSAGE_TYPE_TITLE_KEYS: Record<string, string> = {
  upvoteShare: 'notif.titleUpvoteShare',
  subscribe: 'notif.titleSubscribe',
  unsubscribe: 'notif.titleUnsubscribe',
  subscribePrivate: 'notif.titleSubscribePrivate',
  answer: 'notif.titleAnswer',
  post: 'notif.titlePost',
  userInfo: 'notif.titleUserInfo',
  comment: 'notif.titleComment',
  repost: 'notif.titleRepost',
}

/** Маппинг типов событий RPC → нормализованные типы NotificationItem */
export const MESSAGE_TYPE_MAP: Record<string, string> = {
  upvoteShare: 'rating',
  subscribe: 'subscribe',
  unsubscribe: 'subscribe',
  answer: 'comment',
  post: 'other',
  comment: 'comment',
  repost: 'repost',
}

/** Допустимые типы уведомлений */
export const ALLOWED_NOTIFICATION_TYPES = [
  'comment', 'like', 'subscribe', 'repost', 'mention', 'rating', 'tip', 'other',
] as const
