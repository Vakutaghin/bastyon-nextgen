import { describe, it, expect } from 'vitest'

import {
  MAX_TRANSFER_FEE_SATOSHIS,
  MIN_RELAY_FEE_SAT_PER_KB,
  MIN_TRANSFER_FEE_SATOSHIS,
  estimateTransferSizeBytes,
  transferFee,
  transferFeeSatoshis,
} from './transfer-fee'

describe('комиссия денежного перевода', () => {
  it('размер растёт от входов, выходов и сообщения', () => {
    const base = estimateTransferSizeBytes({ inputs: 1, outputs: 1 })
    expect(estimateTransferSizeBytes({ inputs: 2, outputs: 1 })).toBe(base + 148)
    expect(estimateTransferSizeBytes({ inputs: 1, outputs: 2 })).toBe(base + 34)
    expect(estimateTransferSizeBytes({ inputs: 1, outputs: 1, messageBytes: 6 })).toBe(base + 17)
  })

  it('сдачу считаем всегда: оценка не должна оказаться меньше настоящего размера', () => {
    // один вход, один получатель, сдача: 14 + 148 + 34*2 = 230
    expect(estimateTransferSizeBytes({ inputs: 1, outputs: 1 })).toBe(230)
  })

  it('комиссия заведомо выше минимума релея', () => {
    const shape = { inputs: 3, outputs: 1, messageBytes: 6 }
    const size = estimateTransferSizeBytes(shape)
    const minimum = Math.ceil((size * MIN_RELAY_FEE_SAT_PER_KB) / 1000)
    expect(transferFeeSatoshis(shape)).toBeGreaterThan(minimum)
  })

  it('у маленького перевода комиссия не падает ниже нижней границы', () => {
    expect(transferFeeSatoshis({ inputs: 1, outputs: 1 })).toBe(MIN_TRANSFER_FEE_SATOSHIS)
  })

  it('у огромной транзакции комиссия упирается в предохранитель', () => {
    expect(transferFeeSatoshis({ inputs: 5000, outputs: 5000 })).toBe(MAX_TRANSFER_FEE_SATOSHIS)
  })

  it('в PKOIN — то же число, делённое на сто миллионов', () => {
    const shape = { inputs: 2, outputs: 1 }
    expect(transferFee(shape)).toBeCloseTo(transferFeeSatoshis(shape) / 1e8, 12)
  })

  it('комиссия перевода на порядки выше, чем один сатоши социальной транзакции', () => {
    expect(transferFeeSatoshis({ inputs: 1, outputs: 1 })).toBeGreaterThan(100)
  })
})
