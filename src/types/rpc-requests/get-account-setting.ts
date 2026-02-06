/**
 * Типы для запроса getaccountsetting API
 *
 * # getaccountsetting - получение настроек аккаунта
 *
 * ## TODO: Требуется уточнение параметров
 *
 * Параметры запроса требуют уточнения из оригинального приложения.
 * Пример тела запроса пока не найден.
 *
 * ## Параметры запроса:
 *
 * Параметры зависят от реализации.
 * Требует уточнения из оригинального приложения.
 *
 * **Пример использования:**
 * ```typescript
 * // Получить настройки аккаунта (требует авторизации)
 * const request: GetAccountSettingRequest = {
 *   method: 'getaccountsetting',
 *   parameters: [
 *     // Параметры требуют уточнения
 *   ],
 *   options: { auth: true } // Требует авторизации
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через соответствующий RPC метод
 * - Используется для получения и восстановления настроек пользователя
 * - Требует авторизации
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getaccountsetting
 *
 * TODO: Требуется уточнение структуры параметров из оригинального приложения.
 * Пример тела запроса пока не найден.
 *
 * Точная структура параметров требует уточнения из оригинального приложения.
 */
export type GetAccountSettingParameters = unknown[]

/**
 * Запрос getaccountsetting API
 *
 * Используется для получения настроек аккаунта текущего пользователя.
 * Требует авторизации.
 */
export interface GetAccountSettingRequest extends BaseRpcRequest<GetAccountSettingParameters> {
  /** Название метода */
  method: 'getaccountsetting'
  /** Параметры запроса - требуют уточнения */
  parameters: GetAccountSettingParameters
}
