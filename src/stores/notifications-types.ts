// Доменные типы стора уведомлений. Вынесены из notifications-store.ts.
// Реэкспортируются оттуда, чтобы старые импорты `@/stores/notifications-store`
// продолжали работать.

export type NotificationType =
  | 'comment'
  | 'like'
  | 'subscribe'
  | 'repost'
  | 'mention'
  | 'rating'
  | 'tip'
  | 'other'

export interface NotificationPostSnapshot {
  txid: string
  caption?: string
  message?: string
  type?: string
  images?: string[]
}

export interface NotificationCommentSnapshot {
  id: string
  postid?: string
  parentid?: string
  answerid?: string
  address?: string
  message?: string
}

export interface NotificationUserSnapshot {
  address: string
  name?: string
  avatar?: string
  reputation?: number
}

export interface NotificationItem {
  id: string
  /** Номер блока (для указателя «прочитано до» и подсчёта непрочитанных) */
  nblock?: number
  type: NotificationType
  title: string
  description?: string
  /** Unix timestamp (seconds) */
  time: number
  /** Link for navigation (e.g. post url, profile) */
  link?: string
  seen: boolean
  /** Optional: related user address or name */
  from?: string
  /** Optional: related content id */
  shareId?: string
  /** Raw mesType from API (для filter mapping: comment, answer, upvoteShare, subscribe, ...) */
  mesType?: string
  /** Для upvoteShare: значение оценки (положительное — апвоут, отрицательное — даунвоут) */
  upvoteVal?: number
  /**
   * Снимок связанного контента, если RPC отдал его вместе с событием.
   * Не сохраняется в IDB — только в памяти, для превью.
   */
  postSnapshot?: NotificationPostSnapshot
  commentSnapshot?: NotificationCommentSnapshot
  fromSnapshot?: NotificationUserSnapshot
}

/** Раскладка last-block по адресу в IDB settings. */
export type LastBlockByAddress = Record<string, number>

/** Раскладка скрытых пользователем id по адресу в IDB settings. */
export type HiddenIdsByAddress = Record<string, string[]>
