import { describe, it, expect, vi } from 'vitest'

import {
  computeTransferAmounts,
  InsufficientFundsError,
  sendTransfer,
  type SendTransferDeps,
} from './send-transfer'

const FEE = 0.01
const keyPair = { privateKey: 'k' } as never

function deps(over: Partial<SendTransferDeps> = {}) {
  const d: SendTransferDeps = {
    getUnspents: vi.fn(async () => [{ txid: 'a', vout: 0, amount: 5 }] as never),
    filterAvailableUnspents: vi.fn((u) => u),
    selectAndLockUnspents: vi.fn((u) => u),
    buildTransferTransaction: vi.fn(
      async () => ({ hex: 'HEX', messageData: { m: 1 }, feePaidSatoshis: 1_000_000 }) as never
    ),
    sendTransactionWithMessage: vi.fn(async () => 'TXID'),
    ...over,
  }
  return d
}

describe('computeTransferAmounts', () => {
  it('include: комиссия вычитается из суммы получателя, входов нужно на сумму', () => {
    expect(computeTransferAmounts(1, 'include', FEE)).toEqual({
      receiverAmount: 0.99,
      requiredAmount: 1,
    })
  })
  it('exclude: получатель получает всё, входов нужно на сумму + комиссию', () => {
    expect(computeTransferAmounts(1, 'exclude', FEE)).toEqual({
      receiverAmount: 1,
      requiredAmount: 1.01,
    })
  })
  it('include с суммой ниже комиссии не уходит в минус', () => {
    expect(computeTransferAmounts(0.001, 'include', FEE).receiverAmount).toBe(0)
  })
})

describe('sendTransfer', () => {
  it('собирает и отправляет перевод, возвращает txid и фактическую комиссию (N1)', async () => {
    const d = deps()
    const { txid, feePaidSatoshis } = await sendTransfer(
      {
        fromAddress: 'FROM',
        keyPair,
        toAddress: 'TO',
        amount: 2,
        feemode: 'exclude',
        message: ' hi ',
        fee: FEE,
      },
      d
    )
    expect(txid).toBe('TXID')
    // Комиссия приходит из сборки: заявленная + сгоревшая сдача.
    expect(feePaidSatoshis).toBe(1_000_000)
    expect(d.getUnspents).toHaveBeenCalledWith('FROM', 1, 9999999)
    expect(d.filterAvailableUnspents).toHaveBeenCalledWith(expect.any(Array), false)
    expect(d.selectAndLockUnspents).toHaveBeenCalledWith(expect.any(Array), 2.01)
    expect(d.buildTransferTransaction).toHaveBeenCalledWith({
      unspents: [{ txid: 'a', vout: 0, amount: 5 }],
      fromAddress: 'FROM',
      sourceAddresses: ['FROM'],
      keyPair,
      outputs: [{ address: 'TO', amount: 2 }],
      fee: FEE,
      message: 'hi',
      feemode: 'exclude',
    })
    expect(d.sendTransactionWithMessage).toHaveBeenCalledWith({
      hex: 'HEX',
      messageData: { m: 1 },
      operationType: 'transaction',
    })
  })

  it('include: получатель получает сумму минус комиссия', async () => {
    const d = deps()
    await sendTransfer(
      { fromAddress: 'FROM', keyPair, toAddress: 'TO', amount: 1, feemode: 'include', fee: FEE },
      d
    )
    expect(d.buildTransferTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ outputs: [{ address: 'TO', amount: 0.99 }], feemode: 'include' })
    )
  })

  it('нет подходящих входов → InsufficientFundsError, ничего не собирается и не шлётся', async () => {
    const d = deps({ selectAndLockUnspents: vi.fn(() => []) })
    await expect(
      sendTransfer(
        { fromAddress: 'FROM', keyPair, toAddress: 'TO', amount: 1, feemode: 'include' },
        d
      )
    ).rejects.toBeInstanceOf(InsufficientFundsError)
    expect(d.buildTransferTransaction).not.toHaveBeenCalled()
    expect(d.sendTransactionWithMessage).not.toHaveBeenCalled()
  })

  it('ошибка сети пробрасывается как есть', async () => {
    const d = deps({
      sendTransactionWithMessage: vi.fn(async () => {
        throw new Error('node down')
      }),
    })
    await expect(
      sendTransfer(
        { fromAddress: 'FROM', keyPair, toAddress: 'TO', amount: 1, feemode: 'include' },
        d
      )
    ).rejects.toThrow('node down')
  })
})
