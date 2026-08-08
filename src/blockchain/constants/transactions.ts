/**
 * Константы для работы с транзакциями Pocketnet
 */

/**
 * Множитель для конвертации суммы в сатоши
 * 1 PKOIN = 100,000,000 сатоши
 */
export const AMOUNT_MULTIPLIER = 100000000

/**
 * Комиссия за транзакцию (в PKOIN)
 * По умолчанию: 0.00000001 PKOIN (1 сатоши)
 */
export const DEFAULT_TX_FEE = 1 / AMOUNT_MULTIPLIER

/**
 * Минимальная сумма для выхода транзакции (dust value)
 * Выходы меньше этой суммы считаются пылью и не обрабатываются
 * По умолчанию: 0.00000700 PKOIN (700 сатоши)
 */
export const DUST_VALUE = 700 / AMOUNT_MULTIPLIER

/**
 * Минимальное количество unspents для оптимизации
 */
export const OPTIMIZE_UNSPENTS_MIN = 80

/**
 * Максимальное количество unspents для оптимизации
 */
export const OPTIMIZE_UNSPENTS_MAX = 300

/**
 * Количество подтверждений для созревания coinbase транзакций
 */
export const COINBASE_MATURITY = 100

/**
 * Количество подтверждений для созревания pocketnet транзакций (pockettx)
 * Pockettx транзакции (например, награды) требуют времени для созревания
 */
export const POCKETNET_TX_MATURITY = 10

/**
 * Конвертирует PKOIN в сатоши.
 *
 * `Math.round`, а не `Math.floor` (P2-7): float-арифметика даёт
 * `2.3 * 1e8 = 229999999.99999997`, и `floor` терял бы 1 сатоши (→ 229999999).
 * Округление к ближайшему целому корректно снимает эту дробную погрешность.
 */
export function toSatoshis(pkoin: number): number {
  return Math.round(pkoin * AMOUNT_MULTIPLIER)
}

/**
 * Конвертирует сатоши в PKOIN
 */
export function fromSatoshis(satoshis: number): number {
  return satoshis / AMOUNT_MULTIPLIER
}
