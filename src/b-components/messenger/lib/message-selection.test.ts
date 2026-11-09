import { describe, expect, it } from 'vitest'

import type { Message } from '../types'
import { canDeleteAll, canReplyTo, rangeIds, selectionText } from './message-selection'

function msg(id: string, over: Partial<Message> = {}): Message {
  return {
    id,
    chatId: '!room:host',
    senderId: '@alice:host',
    text: `text ${id}`,
    timestamp: 0,
    read: true,
    status: 'read',
    ...over,
  }
}

describe('выделение сообщений: диапазон', () => {
  const order = ['a', 'b', 'c', 'd']

  it('в обе стороны, включая края', () => {
    expect(rangeIds(order, 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(rangeIds(order, 'd', 'b')).toEqual(['b', 'c', 'd'])
    expect(rangeIds(order, 'c', 'c')).toEqual(['c'])
  })

  it('кого нет в ленте — пусто', () => {
    expect(rangeIds(order, 'a', 'x')).toEqual([])
  })
})

describe('выделение сообщений: текст для буфера', () => {
  const parts = {
    name: (m: Message) => (m.senderId === 'me' ? 'Я' : 'Алиса'),
    time: (m: Message) => `t${m.timestamp}`,
    body: (m: Message) => m.text,
  }

  it('одно сообщение — только его текст', () => {
    expect(selectionText([msg('$1', { text: 'Привет' })], parts)).toBe('Привет')
  })

  it('несколько — «Имя, [время]» и пустая строка между ними, как в Telegram', () => {
    const text = selectionText(
      [
        msg('$1', { text: 'Привет', timestamp: 1 }),
        msg('$2', { senderId: 'me', text: 'Ага\nда', timestamp: 2 }),
      ],
      parts
    )
    expect(text).toBe('Алиса, [t1]\nПривет\n\nЯ, [t2]\nАга\nда')
  })
})

describe('выделение сообщений: что можно сделать', () => {
  const mine = (m: Message) => m.senderId === 'me'

  it('ответить — на сообщение с сервера и на Meshtastic с id пакета', () => {
    expect(canReplyTo(msg('$1'))).toBe(true)
    expect(canReplyTo(msg('temp-1'))).toBe(false)
    expect(canReplyTo(msg('m1', { transport: 'meshtastic', meshReplyable: true }))).toBe(true)
    expect(canReplyTo(msg('m2', { transport: 'meshcore' }))).toBe(false)
  })

  it('удалить — только когда можно все: свои всегда, чужие — по правам комнаты', () => {
    const own = msg('$1', { senderId: 'me' })
    const foreign = msg('$2')
    let asked = 0
    const allowed = (ok: boolean) => () => {
      asked += 1
      return ok
    }
    expect(canDeleteAll([own], mine, allowed(false))).toBe(true)
    // Чужих нет — права не спрашиваем.
    expect(asked).toBe(0)
    expect(canDeleteAll([own, foreign], mine, allowed(true))).toBe(true)
    expect(canDeleteAll([own, foreign], mine, allowed(false))).toBe(false)
  })

  it('неотправленное, mesh или ничего не выделено — удалить нельзя', () => {
    const always = () => true
    expect(
      canDeleteAll([msg('$1', { senderId: 'me' }), msg('temp-2', { senderId: 'me' })], mine, always)
    ).toBe(false)
    expect(canDeleteAll([msg('$1', { senderId: 'me', transport: 'lxmf' })], mine, always)).toBe(
      false
    )
    expect(canDeleteAll([], mine, always)).toBe(false)
  })
})
