// Подпись-плашка типа уведомления: подтип с ноды (mesType) важнее общего типа,
// низкая оценка отличается от обычной, у любого сочетания есть перевод.
import { describe, expect, it } from 'vitest'
import ru from '@/locales/ru'
import en from '@/locales/en'
import { LOW_RATING_MAX_VAL } from '@/stores/notification-filtering'
import type { NotificationItem, NotificationType } from '@/stores/notifications-store'
import { notificationTypeLabelKey } from './notification-type-map'

const item = (over: Partial<NotificationItem>): NotificationItem => ({
  id: 'n1',
  type: 'other',
  title: '',
  time: 0,
  seen: false,
  ...over,
})

/** Значение по точечному ключу словаря (`notif.typeRating`). */
function lookup(dict: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict)
}

describe('notificationTypeLabelKey', () => {
  it('оценка поста: до порога включительно — «низкая», выше или без значения — обычная', () => {
    expect(
      notificationTypeLabelKey(item({ mesType: 'upvoteShare', upvoteVal: LOW_RATING_MAX_VAL }))
    ).toBe('notif.typeLowRating')
    expect(notificationTypeLabelKey(item({ mesType: 'upvoteShare', upvoteVal: 1 }))).toBe(
      'notif.typeLowRating'
    )
    expect(
      notificationTypeLabelKey(item({ mesType: 'upvoteShare', upvoteVal: LOW_RATING_MAX_VAL + 1 }))
    ).toBe('notif.typeRating')
    expect(notificationTypeLabelKey(item({ mesType: 'upvoteShare' }))).toBe('notif.typeRating')
  })

  it('подтип важнее типа: ответ на ваш комментарий — «ответ», а не «комментарий»', () => {
    expect(notificationTypeLabelKey(item({ type: 'comment', mesType: 'answer' }))).toBe(
      'notif.typeAnswer'
    )
    expect(notificationTypeLabelKey(item({ type: 'comment', mesType: 'comment' }))).toBe(
      'notif.typeComment'
    )
    expect(notificationTypeLabelKey(item({ type: 'other', mesType: 'paidSubscription' }))).toBe(
      'notif.typePaidSubscription'
    )
  })

  it('незнакомый подтип — подпись по общему типу', () => {
    expect(notificationTypeLabelKey(item({ type: 'tip', mesType: 'somethingNew' }))).toBe(
      'notif.typeTip'
    )
    expect(notificationTypeLabelKey(item({ type: 'like' }))).toBe('notif.typeRating')
    expect(notificationTypeLabelKey(item({ type: 'mention' }))).toBe('notif.typeMention')
  })

  it('ничего не известно — общая подпись «уведомление»', () => {
    expect(notificationTypeLabelKey(item({ type: 'other' }))).toBe('notif.typeDefault')
    expect(notificationTypeLabelKey(item({ type: 'other', mesType: 'x' }))).toBe(
      'notif.typeDefault'
    )
  })

  it('у каждой подписи есть перевод в ru и en', () => {
    const mesTypes = [
      'upvoteShare',
      'upvoteComment',
      'comment',
      'answer',
      'subscribe',
      'subscribePrivate',
      'unsubscribe',
      'repost',
      'postfromprivate',
      'boost',
      'win',
      'donation',
      'paidSubscription',
      'userInfo',
    ]
    const types: NotificationType[] = [
      'comment',
      'like',
      'subscribe',
      'repost',
      'mention',
      'rating',
      'tip',
      'other',
    ]
    const keys = new Set<string>([
      notificationTypeLabelKey(item({ mesType: 'upvoteShare', upvoteVal: 1 })),
      ...mesTypes.map((mesType) => notificationTypeLabelKey(item({ mesType }))),
      ...types.map((type) => notificationTypeLabelKey(item({ type }))),
    ])
    for (const key of keys) {
      expect(typeof lookup(ru, key), `ru: ${key}`).toBe('string')
      expect(typeof lookup(en, key), `en: ${key}`).toBe('string')
    }
  })
})
