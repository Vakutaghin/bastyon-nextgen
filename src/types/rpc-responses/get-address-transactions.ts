import type { BaseRpcResponse, StandardRpcTime } from './common'
import type { Transaction } from './get-transactions'

/**
 * Постраничный список транзакций по адресу: getaddresstransactions(address,
 * topHeight, skip, pageSize, direction, types) — см.
 * helpers/explorer/address-transactions.
 *
 * Возвращает те же транзакции, что и gettransactions, отфильтрованные по адресу.
 */
export type GetAddressTransactionsResponse = BaseRpcResponse<Transaction[], StandardRpcTime>
