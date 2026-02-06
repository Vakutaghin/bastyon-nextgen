/**
 * Типы для запроса getaccountearning API
 *
 * # getaccountearning - получение заработка аккаунта
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
 * // Получить заработок аккаунта (требует авторизации)
 * const request: GetAccountEarningRequest = {
 *   method: 'getaccountearning',
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
 * - Используется для отображения статистики доходов пользователя
 * - Требует авторизации
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getaccountearning
 *
 * TODO: Требуется уточнение структуры параметров из оригинального приложения.
 * Пример тела запроса пока не найден.
 *
 * Точная структура параметров требует уточнения из оригинального приложения.
 */
export type GetAccountEarningParameters = unknown[]

/**
 * Запрос getaccountearning API
 *
 * Используется для получения информации о заработке аккаунта.
 * Требует авторизации.
 */
export interface GetAccountEarningRequest extends BaseRpcRequest<GetAccountEarningParameters> {
  /** Название метода */
  method: 'getaccountearning'
  /** Параметры запроса - требуют уточнения */
  parameters: GetAccountEarningParameters
}
