// Куда ведёт уведомление. Чистая функция: решение отдельно от перехода
// (open-notification), чтобы его можно было проверить без компонентов.
//
// Раньше переход решался в панели по месту: пост открывался, только если он
// уже успел догрузиться, иначе — запасной путь в профиль отправителя. Оценка
// комментария вела в профиль оценившего всегда: её пост находился через
// комментарий, а комментарий не догружался вовсе.

import type { NotificationCommentSnapshot, NotificationItem } from './notifications-types'

export type NotificationTarget =
  /** Пост; с `commentId` — прокрутить к комментарию и подсветить. */
  | { kind: 'post'; postId: string; commentId?: string; parentId?: string }
  /** Комментарий, чей пост ещё неизвестен: сначала догрузить комментарий. */
  | { kind: 'comment'; commentId: string }
  | { kind: 'profile'; address: string }
  | { kind: 'wallet' }
  | { kind: 'paidSubscribers' }
  | { kind: 'link'; link: string }
  | { kind: 'none' }

/** Комментарий к вашему посту или ответ вам: на него можно ответить. */
export function isReplyableNotification(item: NotificationItem): boolean {
  return item.type === 'comment'
}

/** id комментария, о котором уведомление: сам комментарий или оценённый ваш. */
export function notificationCommentId(item: NotificationItem): string | undefined {
  if (isReplyableNotification(item)) return item.id
  return item.mesType === 'upvoteComment' ? item.commentId : undefined
}

/**
 * Корневой комментарий ветки: из события, а у оценки и старых записей — из
 * догруженного комментария. `''` — комментарий сам корневой (у догруженного
 * пустой `parentid` теряется — поэтому «есть комментарий, нет parentid» = корень),
 * `undefined` — пока неизвестно.
 */
export function notificationParentId(
  item: NotificationItem,
  comment: NotificationCommentSnapshot | undefined
): string | undefined {
  if (item.parentId !== undefined) return item.parentId
  return comment ? (comment.parentid ?? '') : undefined
}

export function notificationTarget(
  item: NotificationItem,
  comment: NotificationCommentSnapshot | undefined
): NotificationTarget {
  // Оплата платной подписки — к списку своих платных подписчиков.
  if (item.mesType === 'paidSubscription') return { kind: 'paidSubscribers' }
  // Монеты — перевод или награда — видны в истории кошелька. Монеты к
  // комментарию — это комментарий (type 'comment'), он ведёт к нему.
  if (item.type === 'tip' || item.mesType === 'win') return { kind: 'wallet' }

  const sender = item.from ?? item.fromSnapshot?.address
  if (item.type === 'subscribe' || item.mesType === 'userInfo') {
    return sender ? { kind: 'profile', address: sender } : { kind: 'none' }
  }

  const commentId = notificationCommentId(item)
  const postId = item.shareId ?? comment?.postid
  if (commentId) {
    if (!postId) return { kind: 'comment', commentId }
    const parentId = notificationParentId(item, comment)
    return {
      kind: 'post',
      postId,
      commentId,
      ...(parentId ? { parentId } : {}),
    }
  }
  if (postId) return { kind: 'post', postId }
  if (item.link) return { kind: 'link', link: item.link }
  return sender ? { kind: 'profile', address: sender } : { kind: 'none' }
}

/** Ответ вошедшего в ветке (не удалённый) — тот, что адресован этому комментарию. */
export interface ThreadReply {
  address?: string
  answerid?: string
  deleted?: boolean | string
}

/**
 * Вы уже ответили на комментарий: в его ветке есть ваш ответ, адресованный
 * ему. Ответ на корневой комментарий приложение и прежний клиент шлют с
 * `answerid` = корень, но бывает и пустой — он тоже ответ корню.
 */
export function isAnsweredInThread(
  replies: ThreadReply[],
  me: string,
  commentId: string,
  rootId: string
): boolean {
  return replies.some(
    (r) =>
      r.address === me &&
      !(r.deleted === true || r.deleted === 'true') &&
      (r.answerid === commentId || (commentId === rootId && !r.answerid))
  )
}
