// Разделы окна уведомлений: каждое событие — в свой раздел, упоминания и
// обновления профиля — только во «Все».

import { describe, expect, it } from 'vitest'

import { countByCategory, notificationCategory } from './notification-categories'
import type { NotificationItem } from './notifications-types'

const item = (type: NotificationItem['type'], mesType?: string) =>
  ({ id: `${type}-${mesType}`, type, mesType }) as NotificationItem

describe('notificationCategory', () => {
  it('комментарий и ответ — «Комментарии», оценка комментария — нет', () => {
    expect(notificationCategory(item('comment', 'comment'))).toBe('comments')
    expect(notificationCategory(item('comment', 'answer'))).toBe('comments')
    expect(notificationCategory(item('rating', 'upvoteComment'))).toBe('ratings')
  })

  it('оценки, подписчики, PKOIN, посты', () => {
    expect(notificationCategory(item('rating', 'upvoteShare'))).toBe('ratings')
    expect(notificationCategory(item('like'))).toBe('ratings')
    expect(notificationCategory(item('subscribe', 'subscribePrivate'))).toBe('subscribers')
    expect(notificationCategory(item('subscribe', 'unsubscribe'))).toBe('subscribers')
    expect(notificationCategory(item('tip', 'transaction'))).toBe('coins')
    expect(notificationCategory(item('tip', 'donation'))).toBe('coins')
    expect(notificationCategory(item('other', 'win'))).toBe('coins')
    expect(notificationCategory(item('repost', 'repost'))).toBe('posts')
    expect(notificationCategory(item('other', 'boost'))).toBe('posts')
    expect(notificationCategory(item('other', 'postfromprivate'))).toBe('posts')
  })

  it('упоминание и обновление профиля — ни в один раздел', () => {
    expect(notificationCategory(item('mention'))).toBeNull()
    expect(notificationCategory(item('other', 'userInfo'))).toBeNull()
  })
})

describe('countByCategory', () => {
  it('считает по разделам', () => {
    expect(
      countByCategory([
        item('comment', 'comment'),
        item('comment', 'answer'),
        item('rating', 'upvoteShare'),
        item('tip', 'transaction'),
        item('mention'),
      ])
    ).toEqual({ comments: 2, ratings: 1, subscribers: 0, coins: 1, posts: 0 })
  })
})
