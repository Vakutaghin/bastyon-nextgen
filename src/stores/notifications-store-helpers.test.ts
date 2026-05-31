import { describe, it, expect } from 'vitest'
import {
  mapMissedEventToNotification,
  unwrapNotificationResponse,
  isRetryableError,
} from './notifications-store-helpers'

// --- unwrapNotificationResponse ---

describe('unwrapNotificationResponse', () => {
  it('returns array as-is', () => {
    const arr = [{ id: 1 }]
    expect(unwrapNotificationResponse(arr)).toBe(arr)
  })

  it('unwraps { data: [...] }', () => {
    const data = [{ id: 1 }]
    expect(unwrapNotificationResponse({ data })).toBe(data)
  })

  it('unwraps { result: [...] }', () => {
    const result = [{ id: 1 }]
    expect(unwrapNotificationResponse({ result })).toBe(result)
  })

  it('returns empty array for primitives', () => {
    expect(unwrapNotificationResponse('hello')).toEqual([])
    expect(unwrapNotificationResponse(42)).toEqual([])
    expect(unwrapNotificationResponse(null)).toEqual([])
  })

  it('returns empty array for unknown object shape', () => {
    expect(unwrapNotificationResponse({ foo: 'bar' })).toEqual([])
  })
})

// --- isRetryableError ---

describe('isRetryableError', () => {
  it('returns false for null/undefined', () => {
    expect(isRetryableError(null)).toBe(false)
    expect(isRetryableError(undefined)).toBe(false)
  })

  it('returns true for code 408', () => {
    expect(isRetryableError({ code: 408 })).toBe(true)
  })

  it('returns true for status 500', () => {
    expect(isRetryableError({ status: 500 })).toBe(true)
  })

  it('returns true for statusCode 408', () => {
    expect(isRetryableError({ statusCode: 408 })).toBe(true)
  })

  it('returns true for timeout message', () => {
    expect(isRetryableError({ message: 'Request timeout' })).toBe(true)
  })

  it('returns true for TIMEOUT in message (case insensitive)', () => {
    expect(isRetryableError({ message: 'TIMEOUT exceeded' })).toBe(true)
  })

  it('returns false for 404', () => {
    expect(isRetryableError({ code: 404 })).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(isRetryableError('error')).toBe(false)
  })
})

// --- mapMissedEventToNotification ---

describe('mapMissedEventToNotification', () => {
  it('maps upvoteShare event correctly', () => {
    const event = {
      txid: 'abc123',
      nblock: 100,
      mesType: 'upvoteShare',
      time: 1700000000,
      upvoteVal: 5,
      addrFrom: 'PAddr1',
    }
    const result = mapMissedEventToNotification(event)

    expect(result).not.toBeNull()
    expect(result!.id).toBe('abc123')
    expect(result!.type).toBe('rating')
    expect(result!.title).toBe('notif.titleUpvoteShare')
    expect(result!.description).toBe('Оценка: 5')
    expect(result!.time).toBe(1700000000)
    expect(result!.read).toBe(false)
    expect(result!.nblock).toBe(100)
    expect(result!.address).toBe('PAddr1')
  })

  it('maps subscribe event', () => {
    const result = mapMissedEventToNotification({
      txid: 'sub1',
      mesType: 'subscribe',
      nblock: 200,
    })
    expect(result).not.toBeNull()
    expect(result!.type).toBe('subscribe')
    expect(result!.title).toBe('notif.titleSubscribe')
  })

  it('maps comment event', () => {
    const result = mapMissedEventToNotification({
      txid: 'cmt1',
      mesType: 'answer',
      nblock: 300,
    })
    expect(result).not.toBeNull()
    expect(result!.type).toBe('comment')
    expect(result!.title).toBe('notif.titleAnswer')
  })

  it('maps unknown mesType to "other" (which is allowed)', () => {
    const result = mapMissedEventToNotification({
      txid: 'x',
      mesType: 'unknownType',
      nblock: 1,
    })
    expect(result).not.toBeNull()
    expect(result!.type).toBe('other')
    expect(result!.title).toBe('notif.titleDefault')
  })

  it('uses fallback time when time is missing', () => {
    const before = Math.floor(Date.now() / 1000)
    const result = mapMissedEventToNotification({
      txid: 'sub2',
      mesType: 'subscribe',
      nblock: 0,
    })
    expect(result).not.toBeNull()
    expect(result!.time).toBeGreaterThanOrEqual(before)
  })
})
