// Как комиссия ложится на получателей value-транзакции.
//
// feemode 'exclude' — платит отправитель: выходы получателей = запрошенные суммы,
// комиссия уходит из сдачи (билдер вычитает её всегда).
// feemode 'include' — платят получатели: комиссия делится поровну между выходами
// (как в legacy pocketnet.gui `actions.js`: `dfee = fee / outputs.length`).
// Раньше оплата mini-app при include слала полные суммы (аудит P2-4): при
// впритык подобранных входах билдер бросал «Insufficient funds», иначе комиссию
// молча платил отправитель, а в messageData уезжало feemode:include.

import { toSatoshis, fromSatoshis } from '../../constants/transactions'

export interface Receiver {
  address: string
  amount: number
}

export function splitFeeAcrossReceivers(
  receivers: readonly Receiver[],
  feemode: 'include' | 'exclude',
  fee: number
): Receiver[] {
  if (feemode !== 'include' || receivers.length === 0) {
    return receivers.map((r) => ({ address: r.address, amount: r.amount }))
  }
  // Делим в сатоши, чтобы не накопить float-хвост; остаток от деления — первому.
  const feeSat = toSatoshis(fee)
  const share = Math.floor(feeSat / receivers.length)
  let remainder = feeSat - share * receivers.length
  return receivers.map((r) => {
    const extra = remainder > 0 ? 1 : 0
    remainder -= extra
    const amountSat = toSatoshis(r.amount) - share - extra
    if (amountSat <= 0) {
      throw new Error(`Receiver amount ${r.amount} does not cover its share of the fee`)
    }
    return { address: r.address, amount: fromSatoshis(amountSat) }
  })
}
