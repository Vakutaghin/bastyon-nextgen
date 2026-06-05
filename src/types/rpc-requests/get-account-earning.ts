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
 * Параметры запроса getaccountearning: `[address, fromBlock, toBlock]`.
 *
 * Сверено с legacy (`js/satolist.js`): `rpc('getaccountearning', [address, 0, 1627534])`.
 * Сигнатура ноды (`proxy16/node/rpc.js`): `'str int int'`.
 *  - `address` — Pocketnet-адрес пользователя
 *  - `fromBlock` — нижняя граница окна (legacy: `0`)
 *  - `toBlock` — верхняя граница окна (legacy: фикс. `1627534`; в nextgen передаём
 *    заведомо большое значение, чтобы не обрезать недавний заработок).
 */
export type GetAccountEarningParameters = [address: string, fromBlock: number, toBlock: number]

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
