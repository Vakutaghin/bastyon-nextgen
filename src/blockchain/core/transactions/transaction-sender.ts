/**
 * Модуль для отправки транзакций в блокчейн Pocketnet
 */

import { debugLog } from '@/helpers/common/debug-log'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCallWithAuth } from '@/helpers/api/request'

/**
 * Интерфейс для параметров отправки транзакции
 */
export interface SendTransactionParams {
  /** Hex представление транзакции */
  hex: string
  /** Экспортированные данные для сообщения */
  messageData: Record<string, unknown>
  /** Тип операции (например, 'userInfo') */
  operationType: string
}

/**
 * Отправляет транзакцию через sendrawtransactionwithmessage
 * @param params - Параметры отправки транзакции
 * @returns Promise с txid транзакции
 */
export async function sendTransactionWithMessage(params: SendTransactionParams): Promise<string> {
  const { hex, messageData, operationType } = params

  if (!hex || typeof hex !== 'string') {
    throw new Error('Invalid transaction hex')
  }

  if (!messageData || typeof messageData !== 'object') {
    throw new Error('Invalid message data')
  }

  if (!operationType || typeof operationType !== 'string') {
    throw new Error('Invalid operation type')
  }

  try {
    // Вызываем sendrawtransactionwithmessage через RPC
    // rpcCallWithAuth unwraps the { result, data } envelope automatically
    // Параметры: [hex, messageData, operationType]
    const response = await rpcCallWithAuth<unknown>({
      method: rpcEndpoints.sendRawTransactionWithMessage,
      parameters: [hex, messageData, operationType],
      options: { auth: true }, // Требуется авторизация для отправки транзакций
    })

    debugLog('[sendTransaction] Raw response:', JSON.stringify(response).substring(0, 500))

    // Ответ должен содержать txid транзакции
    // After unwrapping, the response is the inner data (e.g. a txid string)
    if (typeof response === 'string') {
      return response
    }

    if (response && typeof response === 'object') {
      const resp = response as Record<string, unknown>
      // Ищем txid в известных полях. НЕ фабрикуем txid из произвольного
      // непустого ответа (P2-6/P3-6): проваленный бродкаст не должен
      // маскироваться под успех со «псевдо-txid» = JSON.stringify(тела).
      const candidate = resp.txid ?? resp.hash ?? resp.txId
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate
      }
    }

    throw new Error('Unexpected response format from sendrawtransactionwithmessage')
  } catch (error) {
    console.error('[sendTransaction] Error details:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to send transaction: ${error.message}`, { cause: error })
    }
    // Если ошибка — объект с кодом (от RPC)
    if (error && typeof error === 'object') {
      const errStr = JSON.stringify(error)
      throw new Error(`Failed to send transaction: ${errStr}`, { cause: error })
    }
    throw new Error(`Failed to send transaction: ${String(error)}`, { cause: error })
  }
}
