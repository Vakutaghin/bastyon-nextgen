import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * Краткое описание блока из getlastblocks.
 *
 * Метод getlastblocks(count, fromHeight=-1, verbose=false) отдаёт массив блоков
 * по убыванию высоты (от tip-а вниз). verbose=true теоретически даёт развёрнутую
 * структуру (как getcompactblock), но в эксплорере мы запрашиваем компактную форму.
 */
export interface LastBlockSummary {
  /** Высота блока в цепочке. */
  height: number
  /** Хеш блока. */
  hash: string
  /** Unix timestamp (в секундах) момента закрытия блока. */
  time: number
  /** Количество транзакций в блоке. */
  ntx: number
}

export type GetLastBlocksResponse = BaseRpcResponse<LastBlockSummary[], StandardRpcTime>
