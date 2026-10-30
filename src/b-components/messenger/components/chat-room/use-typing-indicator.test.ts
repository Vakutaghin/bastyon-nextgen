import { describe, it, expect } from 'vitest'
import { applyTypingEvent, typingFromMembers } from './use-typing-indicator'

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

// m.typing из синка без room_id: кто печатает — по флагам участников открытой
// комнаты (SDK обновляет их раньше события). Проверено на живом Synapse:
// RoomMember.typing на клиент не приходил, и «печатает…» не появлялось.
describe('typingFromMembers', () => {
  it('печатающие участники, кроме себя', () => {
    const r = typingFromMembers(
      [
        { userId: 'bob', typing: true },
        { userId: 'me', typing: true },
        { userId: 'ann', typing: false },
      ],
      'me'
    )
    expect([...r]).toEqual(['bob'])
  })

  it('никто не печатает — пусто', () => {
    expect(typingFromMembers([{ userId: 'bob', typing: false }], 'me').size).toBe(0)
    expect(typingFromMembers([], null).size).toBe(0)
  })
})
