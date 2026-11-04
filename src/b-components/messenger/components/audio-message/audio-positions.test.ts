// Место остановки голосового: помнится по сообщению, 0 — забыто (снова с
// начала), самые давние вытесняются после POSITIONS_LIMIT.

import { describe, expect, it } from 'vitest'
import {
  POSITIONS_LIMIT,
  positionKey,
  rememberPosition,
  rememberedPosition,
} from './audio-positions'

describe('audio-positions', () => {
  it('помнит по чату и сообщению', () => {
    const a = positionKey({ chatId: '!a', id: '$1' })
    const b = positionKey({ chatId: '!b', id: '$1' })
    rememberPosition(a, 2.5)
    expect(rememberedPosition(a)).toBe(2.5)
    expect(rememberedPosition(b)).toBe(0)
  })

  it('ноль и не число — забыть', () => {
    const key = positionKey({ chatId: '!a', id: '$2' })
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      rememberPosition(key, 3)
      rememberPosition(key, bad)
      expect(rememberedPosition(key)).toBe(0)
    }
  })

  it('сверх предела вытесняется самая давняя остановка', () => {
    const keys = Array.from({ length: POSITIONS_LIMIT + 1 }, (_, i) =>
      positionKey({ chatId: '!limit', id: `$${i}` })
    )
    keys.slice(0, POSITIONS_LIMIT).forEach((key) => rememberPosition(key, 1))
    // Первую остановили ещё раз — она теперь свежая.
    rememberPosition(keys[0]!, 2)
    rememberPosition(keys[POSITIONS_LIMIT]!, 1)
    expect(rememberedPosition(keys[0]!)).toBe(2)
    expect(rememberedPosition(keys[1]!)).toBe(0)
    expect(rememberedPosition(keys[POSITIONS_LIMIT]!)).toBe(1)
  })
})
