/**
 * Типы для запроса getlastcomments API
 *
 * # getlastcomments - получение последних комментариев
 *
 * ## Параметры запроса:
 *
 * Метод принимает 3 строковых параметра (обычно все пустые строки для получения последних комментариев).
 *
 * **Пример использования:**
 * ```typescript
 * // Получить последние комментарии
 * const request: GetLastCommentsRequest = {
 *   method: 'getlastcomments',
 *   parameters: ['', '', ''],
 *   options: { auth: false }
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через `api.rpc('getlastcomments', ps)` где `ps` - массив из 3 строк
 * - Обычно все параметры пустые строки
 * - Используется для виджетов последних комментариев
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getlastcomments
 *
 * Три строковых параметра (обычно все пустые строки).
 * Точное назначение параметров требует уточнения из оригинального приложения.
 */
export type GetLastCommentsParameters = [
  param1: string,
  param2: string,
  param3: string
]

/**
 * Запрос getlastcomments API
 *
 * Используется для получения последних комментариев в системе.
 * Не требует авторизации.
 */
export interface GetLastCommentsRequest extends BaseRpcRequest<GetLastCommentsParameters> {
  /** Название метода */
  method: 'getlastcomments'
  /** Параметры запроса - 3 строковых параметра */
  parameters: GetLastCommentsParameters
}
