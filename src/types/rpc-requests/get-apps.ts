/**
 * Типы для запроса getapps API
 *
 * # getapps - получение списка приложений
 *
 * ## Параметры запроса:
 *
 * Параметры передаются как объект (в массиве с одним элементом):
 *
 * **Пример использования:**
 * ```typescript
 * // Получить список приложений
 * const request: GetAppsRequest = {
 *   method: 'getapps',
 *   parameters: [{
 *     tags: [],                                    // tags - фильтр по тегам
 *     search: '',                                  // search - поисковый запрос
 *     topHeight: 3667012,                          // topHeight - высота блока
 *     pageStart: 0,                                // pageStart - начало страницы (пагинация)
 *     pageSize: 20,                                // pageSize - размер страницы
 *     orderBy: 'height',                           // orderBy - поле для сортировки
 *     orderDesc: true,                             // orderDesc - направление сортировки (true = desc)
 *     id: 'app.pocketnet.blockexplorer'            // id - ID конкретного приложения (опционально)
 *   }],
 *   options: { auth: false }
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через соответствующий RPC метод
 * - Используется для получения каталога приложений
 * - Поддерживает фильтрацию, поиск и пагинацию
 */

import type { BaseRpcRequest } from './common'

/**
 * Объект параметров запроса getapps
 *
 * Содержит параметры фильтрации, поиска и пагинации для получения списка приложений.
 */
export interface GetAppsParametersObject {
  /** Фильтр по тегам (массив строк) */
  tags: string[]
  /** Поисковый запрос (строка) */
  search: string
  /** Высота блока (число) */
  topHeight: number
  /** Начало страницы для пагинации (число, обычно 0) */
  pageStart: number
  /** Размер страницы для пагинации (число, например 20) */
  pageSize: number
  /** Поле для сортировки (строка, например 'height') */
  orderBy: string
  /** Направление сортировки (true = desc, false = asc) */
  orderDesc: boolean
  /** ID конкретного приложения (опционально, строка) */
  id?: string
}

/**
 * Параметры запроса getapps
 *
 * Параметры передаются как массив с одним объектом.
 */
export type GetAppsParameters = [GetAppsParametersObject]

/**
 * Запрос getapps API
 *
 * Используется для получения списка приложений.
 * Не требует авторизации.
 */
export interface GetAppsRequest extends BaseRpcRequest<GetAppsParameters> {
  /** Название метода */
  method: 'getapps'
  /** Параметры запроса - требуют уточнения */
  parameters: GetAppsParameters
}
