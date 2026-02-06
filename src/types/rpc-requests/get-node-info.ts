/**
 * Типы для запроса getnodeinfo API
 *
 * # getnodeinfo - получение информации о ноде блокчейна
 *
 * ## Параметры запроса:
 *
 * Метод **не требует параметров** - вызывается с пустым массивом параметров.
 *
 * **Пример использования:**
 * ```typescript
 * // Получить информацию о ноде (не требует авторизации)
 * const request: GetNodeInfoRequest = {
 *   method: 'getnodeinfo',
 *   parameters: [],
 *   options: { auth: false }
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через `api.rpc('getnodeinfo', [])`
 * - Не требует параметров
 * - Результат кешируется на 55 секунд
 * - Используется для проверки состояния сети и версии ноды
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getnodeinfo
 *
 * Пустой массив - метод не требует параметров.
 */
export type GetNodeInfoParameters = []

/**
 * Запрос getnodeinfo API
 *
 * Используется для получения информации о текущей ноде блокчейна.
 * Не требует авторизации и параметров.
 */
export interface GetNodeInfoRequest extends BaseRpcRequest<GetNodeInfoParameters> {
  /** Название метода */
  method: 'getnodeinfo'
  /** Параметры запроса - пустой массив */
  parameters: GetNodeInfoParameters
}
