/**
 * Типы для запроса getuserstatistic API
 *
 * # getuserstatistic - получение статистики пользователя
 *
 * ## Параметры запроса:
 *
 * Параметры передаются как массив с тремя элементами:
 *
 * **Пример использования:**
 * ```typescript
 * // Получить статистику пользователя
 * const request: GetUserStatisticRequest = {
 *   method: 'getuserstatistic',
 *   parameters: [
 *     ['PJT8eTrxXD5uCFL2QmRmdDJtCBA1R68Tdf'], // addresses - массив адресов пользователей
 *     0,                                        // param2 - флаг или тип статистики (обычно 0)
 *     2246708                                   // param3 - высота блока или ID (опционально)
 *   ],
 *   options: { auth: false }
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через соответствующий RPC метод
 * - Используется для отображения статистики пользователя
 * - Параметры: `[[address], flag, height]`
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getuserstatistic
 *
 * @param addresses - Массив адресов пользователей (Pocketnet адреса), для которых нужно получить статистику
 * @param param2 - Флаг или тип статистики (обычно 0)
 * @param param3 - Высота блока или ID (опционально, может быть 0 или конкретное значение)
 */
export type GetUserStatisticParameters = [
  addresses: string[],
  param2: number,
  param3: number
]

/**
 * Запрос getuserstatistic API
 *
 * Используется для получения статистики пользователя.
 * Не требует авторизации.
 */
export interface GetUserStatisticRequest extends BaseRpcRequest<GetUserStatisticParameters> {
  /** Название метода */
  method: 'getuserstatistic'
  /** Параметры запроса - требуют уточнения */
  parameters: GetUserStatisticParameters
}
