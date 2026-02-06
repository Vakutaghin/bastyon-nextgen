/**
 * Типы для запроса gettags API
 *
 * # gettags - получение трендовых тегов
 *
 * ## Параметры запроса:
 *
 * Метод принимает 4 строковых параметра:
 * - address: адрес пользователя (обычно пустая строка для всех тегов)
 * - count: количество тегов (обычно '100')
 * - block: номер блока (обычно округленный блок минус 23700)
 * - localization: ключ локализации (например 'ru', 'en')
 *
 * **Пример использования:**
 * ```typescript
 * const request: GetTagsRequest = {
 *   method: 'gettags',
 *   parameters: ['', '100', '12345', 'ru'],
 *   options: { auth: false }
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через `api.rpcwt('gettags', parameters)`
 * - Используется для получения облака тегов в сайдбаре
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса gettags
 *
 * Четыре строковых параметра:
 * - address: адрес пользователя (обычно пустая строка)
 * - count: количество тегов (обычно '100')
 * - block: номер блока (округленный)
 * - localization: ключ локализации ('ru', 'en' и т.д.)
 */
export type GetTagsParameters = [
  address: string,
  count: string,
  block: string,
  localization: string
]

/**
 * Запрос gettags API
 *
 * Используется для получения трендовых тегов в системе.
 * Не требует авторизации.
 */
export interface GetTagsRequest extends BaseRpcRequest<GetTagsParameters> {
  /** Название метода */
  method: 'gettags'
  /** Параметры запроса - 4 строковых параметра */
  parameters: GetTagsParameters
}
