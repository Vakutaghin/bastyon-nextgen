import type { BaseRpcResponse, StandardRpcTime } from './common'
import type { Transaction } from './get-transactions'

/**
 * Постраничный список транзакций по адресу:
 * getaddresstransactions(address, fromHeight=-1, count, direction?).
 *
 * Возвращает те же транзакции, что и gettransactions, отфильтрованные по адресу.
 */
export type GetAddressTransactionsResponse = BaseRpcResponse<Transaction[], StandardRpcTime>
