import { describe, it, expect } from 'vitest'

import { parseTxUnspentResponse } from './parse-tx-unspent'

describe('parseTxUnspentResponse', () => {
  it('суммирует amount из {result:"success", data:[...]}', () => {
    expect(
      parseTxUnspentResponse({ result: 'success', data: [{ amount: 1.5 }, { amount: 2 }, {}] })
    ).toBe(3.5)
  })
  it('принимает {data:[...]} без result и голый массив', () => {
    expect(parseTxUnspentResponse({ data: [{ amount: 1 }] })).toBe(1)
    expect(parseTxUnspentResponse([{ amount: 4 }, { amount: 0.25 }])).toBe(4.25)
  })
  it('ошибка ноды / мусор → 0', () => {
    expect(parseTxUnspentResponse({ result: 'error', data: [{ amount: 9 }] })).toBe(0)
    expect(parseTxUnspentResponse(null)).toBe(0)
    expect(parseTxUnspentResponse('nope')).toBe(0)
    expect(parseTxUnspentResponse({ data: 'x' })).toBe(0)
  })
})
