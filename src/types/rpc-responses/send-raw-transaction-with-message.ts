/**
 * Типы для ответа RPC метода sendrawtransactionwithmessage
 *
 * При успехе сервер может вернуть:
 * - строку (txid транзакции)
 * - объект с полями result, data (data = txid)
 * - эхо запроса (parameters, method, options, state)
 */

import type { SendRawTransactionWithMessageParameters } from '../rpc-requests/send-raw-transaction-with-message'

/**
 * Ответ sendrawtransactionwithmessage в формате эхо (как в примере)
 */
export interface SendRawTransactionWithMessageResponseEcho {
  parameters: SendRawTransactionWithMessageParameters
  method: 'sendrawtransactionwithmessage'
  options?: { node?: string }
  state?: number
}

/**
 * Ответ sendrawtransactionwithmessage при успехе (типичный вариант)
 */
export interface SendRawTransactionWithMessageResponseSuccess {
  result: 'success'
  data: string
}
