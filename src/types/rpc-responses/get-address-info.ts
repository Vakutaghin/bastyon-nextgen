import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * Сводка по адресу из getaddressinfo(address).
 *
 *  - balance — текущий баланс в PKOIN.
 *  - lastChange — высота блока последнего изменения баланса. -1, если адрес «пустой»
 *    или ни разу не использовался.
 */
export interface AddressInfo {
  balance: number
  lastChange: number
}

export type GetAddressInfoResponse = BaseRpcResponse<AddressInfo, StandardRpcTime>
