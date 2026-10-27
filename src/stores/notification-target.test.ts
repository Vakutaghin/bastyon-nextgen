// Куда ведёт уведомление. Оценка комментария раньше вела в профиль
// оценившего: её пост известен только из комментария, а комментарий не
// догружался. Теперь — к комментарию в посте, а пока он неизвестен — «сначала
// догрузить комментарий», но не в профиль.

import { describe, expect, it } from 'vitest'

import { isAnsweredInThread, notificationParentId, notificationTarget } from './notification-target'
import type { NotificationItem } from './notifications-types'

const note = (over: Partial<NotificationItem>): NotificationItem => ({
  id: 'n1',
  type: 'other',
  title: '',
  time: 0,
  seen: false,
  from: 'PRater',
  ...over,
})

describe('notificationTarget', () => {
  it('оценка комментария без догруженного комментария — сначала комментарий, не профиль', () => {
    const item = note({ type: 'rating', mesType: 'upvoteComment', commentId: 'c7' })
    expect(notificationTarget(item, undefined)).toEqual({ kind: 'comment', commentId: 'c7' })
  })

  it('оценка комментария — к комментарию в посте, с веткой', () => {
    const item = note({ type: 'rating', mesType: 'upvoteComment', commentId: 'r7' })
    expect(notificationTarget(item, { id: 'r7', postid: 'post7', parentid: 'c1' })).toEqual({
      kind: 'post',
      postId: 'post7',
      commentId: 'r7',
      parentId: 'c1',
    })
  })

  it('ответ вам — к ответу; ветка из события, без догрузки', () => {
    const item = note({
      id: 'a1',
      type: 'comment',
      mesType: 'answer',
      shareId: 'post1',
      parentId: 'c1',
    })
    expect(notificationTarget(item, undefined)).toEqual({
      kind: 'post',
      postId: 'post1',
      commentId: 'a1',
      parentId: 'c1',
    })
  })

  it('корневой комментарий к посту — без ветки', () => {
    const item = note({ id: 'c2', type: 'comment', mesType: 'comment', shareId: 'post1' })
    expect(notificationTarget(item, { id: 'c2', postid: 'post1' })).toEqual({
      kind: 'post',
      postId: 'post1',
      commentId: 'c2',
    })
  })

  it('оценка поста, репост, буст — к посту', () => {
    const item = note({ type: 'rating', mesType: 'upvoteShare', shareId: 'post1' })
    expect(notificationTarget(item, undefined)).toEqual({ kind: 'post', postId: 'post1' })
  })

  it('подписка — в профиль, перевод — в кошелёк, оплата подписки — к подписчикам', () => {
    expect(
      notificationTarget(note({ type: 'subscribe', mesType: 'subscribe' }), undefined)
    ).toEqual({ kind: 'profile', address: 'PRater' })
    expect(notificationTarget(note({ type: 'tip', mesType: 'transaction' }), undefined)).toEqual({
      kind: 'wallet',
    })
    expect(
      notificationTarget(note({ type: 'tip', mesType: 'paidSubscription' }), undefined)
    ).toEqual({ kind: 'paidSubscribers' })
  })

  it('монеты к комментарию — это комментарий: к нему, а не в кошелёк', () => {
    const item = note({
      id: 'c3',
      type: 'comment',
      mesType: 'comment',
      donation: true,
      shareId: 'post1',
      parentId: '',
    })
    expect(notificationTarget(item, undefined)).toMatchObject({ kind: 'post', commentId: 'c3' })
  })
})

describe('notificationParentId', () => {
  it('из события; у догруженного комментария пустой parentid — корень; иначе неизвестно', () => {
    expect(notificationParentId(note({ parentId: 'c1' }), undefined)).toBe('c1')
    expect(notificationParentId(note({ parentId: '' }), undefined)).toBe('')
    expect(notificationParentId(note({}), { id: 'x' })).toBe('')
    expect(notificationParentId(note({}), { id: 'x', parentid: 'c9' })).toBe('c9')
    expect(notificationParentId(note({}), undefined)).toBeUndefined()
  })
})

describe('isAnsweredInThread', () => {
  const ME = 'PMe'

  it('ваш ответ адресован комментарию — ответили', () => {
    const replies = [
      { address: 'PBob', answerid: 'c1' },
      { address: ME, answerid: 'r2' },
    ]
    expect(isAnsweredInThread(replies, ME, 'r2', 'c1')).toBe(true)
    expect(isAnsweredInThread(replies, ME, 'r3', 'c1')).toBe(false)
  })

  it('корню — и с answerid корня, и с пустым', () => {
    expect(isAnsweredInThread([{ address: ME, answerid: 'c1' }], ME, 'c1', 'c1')).toBe(true)
    expect(isAnsweredInThread([{ address: ME, answerid: '' }], ME, 'c1', 'c1')).toBe(true)
  })

  it('чужой ответ и ваш удалённый — не в счёт', () => {
    expect(isAnsweredInThread([{ address: 'PBob', answerid: 'c1' }], ME, 'c1', 'c1')).toBe(false)
    expect(
      isAnsweredInThread([{ address: ME, answerid: 'c1', deleted: true }], ME, 'c1', 'c1')
    ).toBe(false)
  })
})
