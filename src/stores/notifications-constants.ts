// Константы стора уведомлений: ключи IDB settings и человекочитаемые заголовки типов.

/** Ключ в settings IDB: { [address]: block } — последний прочитанный блок. */
export const NOTIFICATIONS_LAST_BLOCK_KEY = 'notificationsLastBlock'

/** Ключ в settings IDB: { [address]: id[] } — скрытые пользователем уведомления. */
export const NOTIFICATIONS_HIDDEN_IDS_KEY = 'notificationsHiddenIds'

/** Заголовок уведомления по mesType (для всплывающих и списка). */
export const MES_TYPE_TITLES: Record<string, string> = {
  upvoteShare: 'Оценка поста',
  subscribe: 'Новый подписчик',
  unsubscribe: 'Отписка',
  subscribePrivate: 'Приватная подписка',
  answer: 'Ответ на комментарий',
  post: 'Новый пост',
  userInfo: 'Обновление профиля',
  comment: 'Комментарий',
  repost: 'Репост',
}
