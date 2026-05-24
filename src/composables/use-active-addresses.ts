/**
 * Топ активных адресов за последние N блоков.
 *
 * Считаем сами по данным любой ноды (никакого центрального хоста типа
 * `bastyon.com/blockexplorer/topaddresses/30.json` — это противоречит
 * [[principle_decentralization]]).
 *
 * Реализация:
 *   1. getlastblocks(blockDepth) — список последних блоков (быстро, 1 запрос).
 *   2. Для каждого блока — getblocktransactions(hash, 0, txLimit) с ограниченным
 *      параллелизмом, чтобы не задавить ноду.
 *   3. Aggregator считает уникальные адреса и сортирует по активности.
 *
 * Тяжёлый запрос → staleTime 5 минут + refetchOnWindowFocus=false. По умолчанию
 * blockDepth=50 (~50 минут истории, разумный баланс глубины и времени запроса).
 */

import { useQuery } from '@tanstack/vue-query'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import type { GetLastBlocksResponse } from '@/types/rpc-responses/get-last-blocks'
import type { GetBlockTransactionsResponse } from '@/types/rpc-responses/get-transactions'
import type { Transaction } from '@/types/rpc-responses/get-transactions'
import {
  aggregateActiveAddresses,
  type ActiveAddress,
} from '@/pages/block-explorer-page/components/top-addresses/aggregate-active-addresses'

export interface ActiveAddressesData {
  /** Топ-список адресов (отсортирован по убыванию активности). */
  addresses: ActiveAddress[]
  /** Сколько блоков реально обработали. */
  blocksScanned: number
  /** Общее число транзакций в анализе. */
  txCount: number
}

interface UseActiveAddressesOptions {
  /** Сколько последних блоков сканировать. По умолчанию 50. */
  blockDepth?: number
  /** Сколько tx брать из каждого блока. По умолчанию 100 (covers most blocks). */
  txLimit?: number
  /** Сколько одновременных getblocktransactions запросов. По умолчанию 3. */
  concurrency?: number
}

const STALE_MS = 5 * 60_000

/**
 * Запускает массив async-задач с ограниченным параллелизмом.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await task(items[i]!)
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return out
}

export function useActiveAddresses(options: UseActiveAddressesOptions = {}) {
  const blockDepth = options.blockDepth ?? 50
  const txLimit = options.txLimit ?? 100
  const concurrency = options.concurrency ?? 3

  return useQuery<ActiveAddressesData>({
    queryKey: ['explorer', 'active-addresses', blockDepth, txLimit] as const,
    queryFn: async () => {
      const lastBlocksResp = (await getByPRC({
        method: rpcEndpoints.getLastBlocks,
        parameters: [blockDepth, -1, false],
        options: { auth: false },
      })) as GetLastBlocksResponse
      const blocks = lastBlocksResp?.data ?? []
      if (blocks.length === 0) {
        return { addresses: [], blocksScanned: 0, txCount: 0 }
      }

      const blockHashes = blocks.map((b) => b.hash)
      const txsPerBlock = await runWithConcurrency(
        blockHashes,
        concurrency,
        async (hash): Promise<Transaction[]> => {
          try {
            const resp = (await getByPRC({
              method: rpcEndpoints.getBlockTransactions,
              parameters: [hash, 0, txLimit],
              options: { auth: false },
            })) as GetBlockTransactionsResponse
            return resp?.data ?? []
          } catch {
            // Один упавший блок не должен валить весь отчёт.
            return []
          }
        },
      )

      const allTxs = txsPerBlock.flat()
      const addresses = aggregateActiveAddresses(allTxs)
      return {
        addresses,
        blocksScanned: blocks.length,
        txCount: allTxs.length,
      }
    },
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  })
}
