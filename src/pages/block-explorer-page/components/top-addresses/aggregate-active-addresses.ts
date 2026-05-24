/**
 * Агрегатор «активных адресов» по списку транзакций последних блоков.
 *
 * Для каждой tx обходим vin и vout, собираем уникальные адреса и считаем:
 *   - appearances — в скольких tx адрес встретился (хоть как vin, хоть как vout);
 *   - volumeIn    — сумма value по vin-ам с этим адресом (что адрес ОТПРАВИЛ);
 *   - volumeOut   — сумма value по vout-ам с этим адресом (что адрес ПОЛУЧИЛ);
 *   - txCount     — то же что appearances, повторно для удобства сортировки.
 *
 * Сортируем по убыванию `score = appearances` (по числу появлений), потом
 * по `volume = volumeIn + volumeOut`. Это даёт «топ-активных адресов».
 *
 * Внимание: в Pocketnet OP_RETURN-выходы имеют address = "" — их пропускаем.
 * Stake-возвраты (vin → vout на тот же адрес) считаются один раз в vin и один
 * раз в vout — это корректно для метрики активности.
 */

import type { Transaction } from '@/types/rpc-responses/get-transactions'

export interface ActiveAddress {
  address: string
  appearances: number
  txCount: number
  volumeIn: number
  volumeOut: number
}

const EMPTY_ADDR = ''

export function aggregateActiveAddresses(txs: Transaction[]): ActiveAddress[] {
  const map = new Map<string, ActiveAddress>()
  const seenInTx = new Set<string>()

  function get(addr: string): ActiveAddress {
    let row = map.get(addr)
    if (!row) {
      row = { address: addr, appearances: 0, txCount: 0, volumeIn: 0, volumeOut: 0 }
      map.set(addr, row)
    }
    return row
  }

  for (const tx of txs ?? []) {
    seenInTx.clear()

    for (const vin of tx.vin ?? []) {
      const a = vin.address
      if (!a || a === EMPTY_ADDR) continue
      const row = get(a)
      row.volumeIn += vin.value ?? 0
      if (!seenInTx.has(a)) {
        seenInTx.add(a)
        row.appearances += 1
        row.txCount += 1
      }
    }

    for (const vout of tx.vout ?? []) {
      const a = vout.scriptPubKey?.addresses?.[0]
      if (!a || a === EMPTY_ADDR) continue
      const row = get(a)
      row.volumeOut += vout.value ?? 0
      if (!seenInTx.has(a)) {
        seenInTx.add(a)
        row.appearances += 1
        row.txCount += 1
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.appearances !== a.appearances) return b.appearances - a.appearances
    const volA = a.volumeIn + a.volumeOut
    const volB = b.volumeIn + b.volumeOut
    return volB - volA
  })
}
