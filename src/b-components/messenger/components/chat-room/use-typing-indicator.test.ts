import { describe, it, expect } from 'vitest'
import { applyTypingEvent } from './use-typing-indicator'

const ctx = { roomId: 'room1', myId: 'me' }

describe('applyTypingEvent', () => {
  it('добавляет печатающего в активной комнате', () => {
    const r = applyTypingEvent(new Set(), { userId: 'bob', roomId: 'room1', typing: true }, ctx)
    expect([...r]).toEqual(['bob'])
  })

  it('убирает, когда перестал печатать', () => {
    const r = applyTypingEvent(
      new Set(['bob']),
      { userId: 'bob', roomId: 'room1', typing: false },
      ctx
    )
    expect(r.size).toBe(0)
  })

  it('игнорирует другую комнату', () => {
    const r = applyTypingEvent(new Set(), { userId: 'bob', roomId: 'other', typing: true }, ctx)
    expect(r.size).toBe(0)
  })

  it('игнорирует себя', () => {
    const r = applyTypingEvent(new Set(), { userId: 'me', roomId: 'room1', typing: true }, ctx)
    expect(r.size).toBe(0)
  })

  it('игнорирует при отсутствии активной комнаты', () => {
    const r = applyTypingEvent(
      new Set(),
      { userId: 'bob', roomId: 'room1', typing: true },
      {
        roomId: null,
        myId: 'me',
      }
    )
    expect(r.size).toBe(0)
  })

  it('возвращает новое множество (иммутабельность)', () => {
    const prev = new Set<string>()
    const r = applyTypingEvent(prev, { userId: 'bob', roomId: 'room1', typing: true }, ctx)
    expect(r).not.toBe(prev)
    expect(prev.size).toBe(0)
  })
})
