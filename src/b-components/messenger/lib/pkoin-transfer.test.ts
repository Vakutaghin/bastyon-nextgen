import { describe, it, expect } from 'vitest'

import {
  formatPkoinAmount,
  parseFortaTransfer,
  pkoinTransferContent,
  pkoinTransferNote,
  pkoinTransferText,
} from './pkoin-transfer'

describe('pkoin-transfer', () => {
  it('сумма без экспоненты и хвостовых нулей', () => {
    expect(formatPkoinAmount(5)).toBe('5')
    expect(formatPkoinAmount(1.5)).toBe('1.5')
    expect(formatPkoinAmount(1e-8)).toBe('0.00000001')
    expect(formatPkoinAmount(NaN)).toBe('—')
  })

  it('заметка читается из текста сообщения, и только из него', () => {
    expect(pkoinTransferText(1e-7, 'За кофе · спасибо')).toBe(
      '💎 0.0000001 PKOIN · За кофе · спасибо'
    )
    expect(pkoinTransferNote(pkoinTransferText(2, 'строка 1\nстрока 2'))).toBe('строка 1\nстрока 2')
    expect(pkoinTransferNote(pkoinTransferText(2))).toBe('')
    expect(pkoinTransferNote('просто текст · с точкой')).toBe('')
  })

  it('открытая часть события — без заметки', () => {
    const open = pkoinTransferContent({
      txid: 'T',
      amount: 1,
      fromAddress: 'PA',
      toAddress: 'PB',
      message: 'секрет',
    })
    expect(open).toEqual({ pocketnet_transaction: { txid: 'T', amount: 1, from: 'PA', to: 'PB' } })
  })

  it('перевод forta.chat распознаётся только по _transfer и txId', () => {
    expect(
      parseFortaTransfer({ _transfer: true, txId: 'T', amount: '2', from: 'PA', to: 'PB' })
    ).toEqual({ txid: 'T', amount: 2, from: 'PA', to: 'PB', message: '' })
    expect(parseFortaTransfer({ txId: 'T', amount: 1 })).toBeNull()
    expect(parseFortaTransfer({ _transfer: true, amount: 1 })).toBeNull()
    expect(parseFortaTransfer('{"_transfer":true}')).toBeNull()
  })
})
