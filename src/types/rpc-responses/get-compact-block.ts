import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * Компактное представление блока, возвращаемое getcompactblock(hashOrHeight, count=-1).
 *
 * Поле nexthash отсутствует у tip-а (последнего блока в цепочке).
 * Поле prevhash присутствует у всех блоков, кроме генезиса.
 */
export interface CompactBlock {
  height: number
  hash: string
  /** Unix timestamp в секундах. */
  time: number
  /** Количество транзакций в блоке. nTx, не ntx — нода возвращает именно так. */
  nTx: number
  /** Сложность сети для этого блока. */
  difficulty: number
  /** Merkle root транзакций блока. */
  merkleroot: string
  /** Закодированный target в формате compact bits. */
  bits: string
  /** Хеш предыдущего блока. */
  prevhash?: string
  /** Хеш следующего блока. Отсутствует у tip-а. */
  nexthash?: string
}

export type GetCompactBlockResponse = BaseRpcResponse<CompactBlock, StandardRpcTime>
