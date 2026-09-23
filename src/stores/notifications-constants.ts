// Константы стора уведомлений: ключи IDB settings и человекочитаемые заголовки типов.

/** Ключ в settings IDB: { [address]: block } — последний прочитанный блок. */
export const NOTIFICATIONS_LAST_BLOCK_KEY = 'notificationsLastBlock'

/**
 * Ключ в settings IDB: { [address]: block } — курсор ФЕТЧА getmissedinfo.
 * Отдельно от read-pointer: раньше единственным писателем блока был
 * `persistReadPointer()`, поэтому до первого открытия выпадашки каждый опрос
 * стартовал с головы сети и события между запусками терялись (V38).
 */
export const NOTIFICATIONS_FETCH_BLOCK_KEY = 'notificationsFetchBlock'

/** Ключ в settings IDB: { [address]: id[] } — скрытые пользователем уведомления. */
export const NOTIFICATIONS_HIDDEN_IDS_KEY = 'notificationsHiddenIds'

/**
 * Сколько уведомлений держим в IDB на адрес. Раньше записи не чистились
 * никогда, и каждый опрос читал всё накопленное за историю аккаунта (S53).
 */
export const NOTIFICATIONS_KEEP_LIMIT = 300

/**
 * i18n-ключ заголовка уведомления по mesType (для всплывающих и списка).
 * Значения — ключи домена `notif`, резолвятся через t() в месте рендера.
 */
export const MES_TYPE_TITLE_KEYS: Record<string, string> = {
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
