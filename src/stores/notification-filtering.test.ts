// S56/S57: один фильтр на тосты, список и системные уведомления; порог низкой
// оценки — как в legacy (`upvoteVal > 2` = позитив), а не «отрицательная».

import { describe, it, expect } from 'vitest'
import {
  isLowRatingValue,
  isNotificationAllowed,
  LOW_RATING_MAX_VAL,
  type NotificationFilterFlags,
} from './notification-filtering'

const ALL_ON: NotificationFilterFlags = {
  win: true,
  transactions: true,
  upvotes: true,
  downvotes: true,
  comments: true,
  answers: true,
  followers: true,
  commentScore: true,
}

describe('isLowRatingValue (S57)', () => {
  it('treats 1 and 2 stars as a low rating', () => {
    expect(LOW_RATING_MAX_VAL).toBe(2)
    expect(isLowRatingValue(1)).toBe(true)
    expect(isLowRatingValue(2)).toBe(true)
  })

  it('treats 3..5 stars as praise', () => {
    expect(isLowRatingValue(3)).toBe(false)
    expect(isLowRatingValue(5)).toBe(false)
  })

  it('is false when there is no rating at all', () => {
    expect(isLowRatingValue(undefined)).toBe(false)
    expect(isLowRatingValue(null)).toBe(false)
  })
})

describe('isNotificationAllowed (S56)', () => {
  it('routes a 1-star rating to the downvotes toggle', () => {
    const item = { type: 'rating' as const, mesType: 'upvoteShare', upvoteVal: 1 }
    expect(isNotificationAllowed({ ...ALL_ON, downvotes: false }, item)).toBe(false)
    expect(isNotificationAllowed({ ...ALL_ON, upvotes: false }, item)).toBe(true)
  })

  it('routes a 5-star rating to the upvotes toggle', () => {
    const item = { type: 'rating' as const, mesType: 'upvoteShare', upvoteVal: 5 }
    expect(isNotificationAllowed({ ...ALL_ON, upvotes: false }, item)).toBe(false)
    expect(isNotificationAllowed({ ...ALL_ON, downvotes: false }, item)).toBe(true)
  })

  it('honours the toggles that used to do nothing', () => {
    const tip = { type: 'tip' as const, mesType: undefined, upvoteVal: undefined }
    expect(isNotificationAllowed({ ...ALL_ON, transactions: false }, tip)).toBe(false)

    const commentScore = { type: 'rating' as const, mesType: 'upvoteComment', upvoteVal: 4 }
    expect(isNotificationAllowed({ ...ALL_ON, commentScore: false }, commentScore)).toBe(false)

    const win = { type: 'other' as const, mesType: 'win', upvoteVal: undefined }
    expect(isNotificationAllowed({ ...ALL_ON, win: false }, win)).toBe(false)
  })

  it('never shows unsubscribe events and passes unknown types through', () => {
    expect(isNotificationAllowed(ALL_ON, { type: 'subscribe', mesType: 'unsubscribe' })).toBe(false)
    expect(isNotificationAllowed(ALL_ON, { type: 'other', mesType: 'somethingNew' })).toBe(true)
  })
})
