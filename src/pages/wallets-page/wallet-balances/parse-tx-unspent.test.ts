import { describe, it, expect } from 'vitest'

import { parseTxUnspentResponse } from './parse-tx-unspent'

describe('parseTxUnspentResponse — сумма в сатоши (V5)', () => {
  it('берёт amountSat, иначе amount (PKOIN) × 1e8 с округлением', () => {
    expect(
      parseTxUnspentResponse({
        result: 'success',
        data: [{ amount: 0.06249995, amountSat: 6249995 }, { amount: 2 }, {}],
      })
    ).toBe(6249995 + 200000000)
    expect(parseTxUnspentResponse([{ amount: 0.1 }, { amount: 0.2 }])).toBe(30000000)
  })
  it('принимает {data:[...]} без result и голый массив', () => {
    expect(parseTxUnspentResponse({ data: [{ amountSat: 1 }] })).toBe(1)
  })
  it('ошибка ноды / мусор → 0', () => {
    expect(parseTxUnspentResponse({ result: 'error', data: [{ amountSat: 9 }] })).toBe(0)
    expect(parseTxUnspentResponse(null)).toBe(0)
    expect(parseTxUnspentResponse('nope')).toBe(0)
    expect(parseTxUnspentResponse({ data: 'x' })).toBe(0)
  })
})
