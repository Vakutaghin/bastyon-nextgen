/**
 * Транзакции адреса постранично: RPC `getaddresstransactions`.
 *
 * Параметры ноды (сверено на mainnet 22.10.2026): `[адрес, верхний блок,
 * сколько пропустить, размер страницы, направление, типы]`. Верхний блок
 * включается; направление: 0 — все, 1 — входящие, −1 — исходящие; типы —
 * числовые типы транзакций, пустой список — все. Страницы идут от новых к
 * старым, но внутри страницы нода сортирует их по txid — порядок по высоте
 * держит поле `rowNumber`.
 *
 * Раньше приложение звало `[адрес, -1, N]` как «курсор-высоту»: нода читала
 * это как «блоки не выше −1, пропустить N» и отвечала пустым списком. История
 * кошелька и транзакции адреса в обозревателе всегда были пустыми.
 */

import { getByPRC, type RpcRequestConfig } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import type { Transaction } from '@/types/rpc-responses/get-transactions'
import type { GetAddressTransactionsResponse } from '@/types/rpc-responses/get-address-transactions'

/** «Выше любого блока»: первая страница — с самых новых. Влезает в int32 ноды. */
export const ADDRESS_TX_TOP = 999_999_999

/** Где остановилась выдача: следующая страница продолжит отсюда. */
export interface AddressTxCursor {
  /** Верхний блок. После первой страницы закрепляется на её самой новой транзакции. */
  top: number
  /** Сколько транзакций под верхним блоком уже получено. */
  skip: number
  /** Ниже ещё есть транзакции. */
  hasMore: boolean
}

export function startAddressTxCursor(): AddressTxCursor {
  return { top: ADDRESS_TX_TOP, skip: 0, hasMore: true }
}

export interface AddressTxPage {
  /** Транзакции страницы от новых к старым. */
  txs: Transaction[]
  cursor: AddressTxCursor
}

/** Порядок страницы — по `rowNumber`, без него — от новых блоков к старым. */
export function orderAddressTxPage(page: readonly Transaction[]): Transaction[] {
  return [...page].sort((a, b) =>
    a.rowNumber != null && b.rowNumber != null ? a.rowNumber - b.rowNumber : b.height - a.height
  )
}

/**
 * Следующая страница. Верхний блок закрепляется по первой странице: новая
 * транзакция, пришедшая между нажатиями «Загрузить ещё», не сдвинет счёт
 * пропущенных, и страница не повторит хвост прошлой.
 */
export async function fetchAddressTxPage(
  address: string,
  cursor: AddressTxCursor,
  options: { pageSize: number; types?: readonly number[] },
  config?: RpcRequestConfig
): Promise<AddressTxPage> {
  const { pageSize, types = [] } = options
  const resp = (await getByPRC(
    {
      method: rpcEndpoints.getAddressTransactions,
      parameters: [address, cursor.top, cursor.skip, pageSize, 0, [...types]],
      options: { auth: false },
    },
    config
  )) as GetAddressTransactionsResponse
  const txs = orderAddressTxPage(resp?.data ?? [])
  const top =
    cursor.skip === 0 && txs.length > 0 ? Math.max(...txs.map((tx) => tx.height)) : cursor.top
  return {
    txs,
    cursor: { top, skip: cursor.skip + txs.length, hasMore: txs.length >= pageSize },
  }
}
