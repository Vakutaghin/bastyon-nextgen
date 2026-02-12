/**
 * Модуль для отправки транзакций в блокчейн Pocketnet
 */

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'

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
export async function sendTransactionWithMessage(
  params: SendTransactionParams
): Promise<string> {
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
    // Параметры: [hex, messageData, operationType]
    const response = await getByPRCWithAuth({
      method: rpcEndpoints.sendRawTransactionWithMessage,
      parameters: [hex, messageData, operationType],
      options: { auth: true }, // Требуется авторизация для отправки транзакций
    })

    // Ответ должен содержать txid транзакции
    // В зависимости от формата ответа сервера, может быть строка или объект
    if (typeof response === 'string') {
      return response
    }

    if (response && typeof response === 'object') {
      // Если ответ - объект, ищем txid в разных возможных полях
      if ('txid' in response && typeof response.txid === 'string') {
        return response.txid
      }
      if ('data' in response && typeof response.data === 'string') {
        return response.data
      }
      if ('result' in response && typeof response.result === 'string') {
        return response.result
      }
    }

    throw new Error('Unexpected response format from sendrawtransactionwithmessage')
  } catch (error) {
    // Обрабатываем ошибки от RPC
    if (error instanceof Error) {
      throw new Error(`Failed to send transaction: ${error.message}`)
    }
    throw new Error('Failed to send transaction: unknown error')
  }
}
