// Утилиты для извлечения данных из многоуровневых RPC-ответов

/**
 * Разворачивает RPC-ответ, проверяя вложенные уровни data/result.
 * API может возвращать данные в разных обёртках — эта функция их нормализует.
 *
 * Поддерживаемые форматы:
 * - { data: T }
 * - { result: 'success', data: T }
 * - T[] (прямой массив)
 * - T (прямое значение)
 *
 * @param response - ответ RPC-запроса
 * @returns извлечённые данные или null
 */
export function unwrapRpcResponse<T>(response: any): T | null {
  if (response === null || response === undefined) return null

  // Прямой массив — возвращаем как есть
  if (Array.isArray(response)) return response as T

  if (typeof response === 'object') {
    // Формат { result: 'success', data: T }
    if ('result' in response && response.result === 'success' && 'data' in response) {
      return response.data as T
    }

    // Формат { data: T }
    if ('data' in response) {
      return response.data as T
    }
  }

  return response as T
}

/**
 * Извлекает массив из RPC-ответа с гарантией возврата массива.
 * Удобно для запросов, возвращающих списки (посты, комментарии, уведомления).
 *
 * @param response - ответ RPC-запроса
 * @returns массив данных (пустой, если данные не найдены)
 */
export function unwrapRpcArray<T>(response: any): T[] {
  const data = unwrapRpcResponse<T[]>(response)

  if (Array.isArray(data)) return data

  return []
}
