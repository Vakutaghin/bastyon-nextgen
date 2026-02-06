/**
 * Типы для запроса getuserprofile API
 *
 * # getuserprofile - получение профиля пользователя(ей) по адресу(ам)
 *
 * ## Параметры запроса:
 *
 * Параметры передаются как массив, где первый элемент - массив адресов пользователей.
 *
 * **Пример использования:**
 * ```typescript
 * // Получить профиль одного пользователя
 * const request: GetUserProfileRequest = {
 *   method: 'getuserprofile',
 *   parameters: [['PJT8eTrxXD5uCFL2QmRmdDJtCBA1R68Tdf']],
 *   options: { auth: false }
 * }
 *
 * // Получить профили нескольких пользователей
 * const request: GetUserProfileRequest = {
 *   method: 'getuserprofile',
 *   parameters: [['PJT8eTrxXD5uCFL2QmRmdDJtCBA1R68Tdf', 'PJT8eTrxXD5uCFL2QmRmdDJtCBA1R68Tdf']],
 *   options: { auth: false }
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через `api.rpc('getuserprofile', [[address]])`
 * - Параметры: массив адресов в массиве `[['address1', 'address2', ...]]`
 * - Не требует авторизации для просмотра чужих профилей
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getuserprofile
 *
 * Первый элемент - массив адресов пользователей, профили которых нужно получить.
 * Адреса должны быть валидными Pocketnet адресами (начинаются с 'P').
 */
export type GetUserProfileParameters = [addresses: string[]]

/**
 * Запрос getuserprofile API
 *
 * Используется для получения профиля одного или нескольких пользователей по их адресам.
 * Не требует авторизации для просмотра чужих профилей.
 */
export interface GetUserProfileRequest extends BaseRpcRequest<GetUserProfileParameters> {
  /** Название метода */
  method: 'getuserprofile'
  /** Параметры запроса - массив адресов пользователей */
  parameters: GetUserProfileParameters
}
