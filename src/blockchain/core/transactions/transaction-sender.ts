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

    console.log('[sendTransaction] Raw response:', JSON.stringify(response).substring(0, 500))

    // Ответ должен содержать txid транзакции
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
      // Если ответ — объект с data, который содержит txid
      if ('data' in response && response.data && typeof response.data === 'object') {
        const data = response.data as Record<string, unknown>
        if (data.txid && typeof data.txid === 'string') return data.txid
      }
      // Fallback: если есть хоть какой-то непустой ответ — считаем успехом
      // sendrawtransactionwithmessage может вернуть просто txid hash
      const responseStr = JSON.stringify(response)
      if (responseStr.length > 2 && responseStr !== '{}' && responseStr !== '[]') {
        console.log('[sendTransaction] Accepting response as txid:', responseStr.substring(0, 100))
        return responseStr
      }
    }

    throw new Error('Unexpected response format from sendrawtransactionwithmessage')
  } catch (error) {
    console.error('[sendTransaction] Error details:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to send transaction: ${error.message}`)
    }
    // Если ошибка — объект с кодом (от RPC)
    if (error && typeof error === 'object') {
      const errStr = JSON.stringify(error)
      throw new Error(`Failed to send transaction: ${errStr}`)
    }
    throw new Error(`Failed to send transaction: ${String(error)}`)
  }
}
