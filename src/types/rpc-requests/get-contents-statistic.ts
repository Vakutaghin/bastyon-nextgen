/**
 * Типы для запроса getcontentsstatistic API
 *
 * # getcontentsstatistic - получение статистики контента пользователя
 *
 * ## Параметры запроса:
 *
 * Параметры передаются как массив с двумя элементами:
 *
 * **Пример использования:**
 * ```typescript
 * // Получить статистику контента пользователя
 * const request: GetContentsStatisticRequest = {
 *   method: 'getcontentsstatistic',
 *   parameters: [
 *     ['PJU3eTrGXD2uCFВ2QmRmdDJtCGl1R68Tdf'], // addresses - массив адресов пользователей
 *     'video'                                 // contentType - тип контента ('video', 'share', 'post', 'audio' или '' для всех)
 *   ],
 *   options: { auth: false }
 * }
 * ```
 *
 * ## Типы контента:
 *
 * - `'video'` - видео контент
 * - `'share'` - посты с изображениями
 * - `'post'` - текстовые посты
 * - `'audio'` - аудио контент
 * - `''` - все типы контента (опционально)
 *
 * ## В старом приложении:
 *
 * - Вызывается через соответствующий RPC метод
 * - Используется для отображения статистики контента пользователя
 * - Параметры: `[[addresses], contentType]`
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getcontentsstatistic
 *
 * @param addresses - Массив адресов пользователей (Pocketnet адреса), для которых нужно получить статистику
 * @param contentType - Тип контента ('video', 'share', 'post', 'audio' или '' для всех типов)
 */
export type GetContentsStatisticParameters = [
  addresses: string[],
  contentType: 'video' | 'share' | 'post' | 'audio' | ''
]

/**
 * Запрос getcontentsstatistic API
 *
 * Используется для получения статистики контента пользователя.
 * Не требует авторизации.
 */
export interface GetContentsStatisticRequest extends BaseRpcRequest<GetContentsStatisticParameters> {
  /** Название метода */
  method: 'getcontentsstatistic'
  /** Параметры запроса - требуют уточнения */
  parameters: GetContentsStatisticParameters
}
