/**
 * Хелперы для форматирования PKOIN
 *
 * PKOIN использует минимальные единицы (аналог сатоши в Bitcoin)
 * 1 PKOIN = 100,000,000 минимальных единиц (8 знаков после запятой)
 */

/**
 * Константа для конвертации минимальных единиц в PKOIN
 */
export const PKOIN_DECIMALS = 8
export const PKOIN_DIVISOR = 10 ** PKOIN_DECIMALS // 100,000,000

/**
 * Конвертирует баланс из минимальных единиц в PKOIN
 *
 * @param balanceInSmallestUnits - Баланс в минимальных единицах (число или строка)
 * @returns Баланс в PKOIN (число)
 *
 * @example
 * formatPkoinFromSmallestUnits(1012959685) // 10.12959685
 * formatPkoinFromSmallestUnits('1012959685') // 10.12959685
 */
export function formatPkoinFromSmallestUnits(
  balanceInSmallestUnits: number | string | null | undefined
): number {
  if (balanceInSmallestUnits === null || balanceInSmallestUnits === undefined) {
    return 0
  }

  const balance =
    typeof balanceInSmallestUnits === 'string'
      ? parseFloat(balanceInSmallestUnits)
      : balanceInSmallestUnits

  if (isNaN(balance) || balance === 0) {
    return 0
  }

  return balance / PKOIN_DIVISOR
}

/**
 * Форматирует баланс PKOIN для отображения
 *
 * @param balanceInSmallestUnits - Баланс в минимальных единицах (число или строка)
 * @param decimals - Количество знаков после запятой (по умолчанию 2)
 * @param showTrailingZeros - Показывать ли нули в конце (по умолчанию false)
 * @returns Отформатированная строка
 *
 * @example
 * formatPkoin(1012959685) // "10.13"
 * formatPkoin(1012959685, 4) // "10.1296"
 * formatPkoin(100000000, 2, true) // "1.00"
 */
export function formatPkoin(
  balanceInSmallestUnits: number | string | null | undefined,
  decimals: number = 2,
  showTrailingZeros: boolean = false
): string {
  const pkoin = formatPkoinFromSmallestUnits(balanceInSmallestUnits)

  if (pkoin === 0) {
    return showTrailingZeros ? `0.${'0'.repeat(decimals)}` : '0'
  }

  const formatted = pkoin.toFixed(decimals)

  if (showTrailingZeros) {
    return formatted
  }

  // Убираем нули в конце
  return formatted.replace(/\.?0+$/, '')
}

/**
 * Форматирует сумму, уже выраженную в PKOIN (например, `vout.value` или
 * `txunspent.amount` — нода отдаёт их дробными). Никакого деления на 1e8:
 * прогон таких сумм через `formatPkoin` давал «0 PKOIN» (аудит V4/V5).
 *
 * @example
 * formatPkoinAmount(12.5, 4) // "12.5"
 * formatPkoinAmount(0.00001234, 4) // "0"
 */
export function formatPkoinAmount(pkoin: number | null | undefined, decimals: number = 2): string {
  if (pkoin === null || pkoin === undefined || !Number.isFinite(pkoin) || pkoin === 0) return '0'
  return pkoin.toFixed(decimals).replace(/\.?0+$/, '')
}

/**
 * Сумма платежа в уведомлениях и событиях: от 1 PKOIN — до двух знаков после
 * запятой, меньше — до трёх, а если и три нули — до первой ненулевой цифры.
 * Хвостовые нули убираются. Раньше перевод меньше 1 PKOIN в событиях шапки
 * выходил «0»: там обрезалось до двух знаков.
 *
 * @example
 * formatPaymentAmount(12.345) // "12.35"
 * formatPaymentAmount(0.1234) // "0.123"
 * formatPaymentAmount(0.0004) // "0.0004"
 * formatPaymentAmount(0.00012345) // "0.0001"
 */
export function formatPaymentAmount(pkoin: number | null | undefined): string {
  if (pkoin === null || pkoin === undefined || !Number.isFinite(pkoin) || pkoin === 0) return '0'
  const abs = Math.abs(pkoin)
  // Первая ненулевая цифра дробной части: 0.0004 → 4-й знак. Считаем по
  // величине, а не по toFixed(3): 0.0005 при округлении до трёх знаков дало
  // бы «0.001» — вдвое больше.
  const firstDigit = abs < 1 ? Math.ceil(-Math.log10(abs) - 1e-9) : 0
  const decimals = abs >= 1 ? 2 : Math.min(PKOIN_DECIMALS, Math.max(3, firstDigit))
  return pkoin.toFixed(decimals).replace(/\.?0+$/, '')
}

/** То же для суммы в минимальных единицах (сатоши). */
export function formatPaymentSatoshis(satoshis: number | string | null | undefined): string {
  return formatPaymentAmount(formatPkoinFromSmallestUnits(satoshis))
}

/**
 * Форматирует баланс PKOIN с разделителями тысяч
 *
 * @param balanceInSmallestUnits - Баланс в минимальных единицах (число или строка)
 * @param decimals - Количество знаков после запятой (по умолчанию 2)
 * @returns Отформатированная строка с разделителями
 *
 * @example
 * formatPkoinWithSeparators(100000000000) // "1,000.00"
 * formatPkoinWithSeparators(1012959685) // "10.13"
 */
export function formatPkoinWithSeparators(
  balanceInSmallestUnits: number | string | null | undefined,
  decimals: number = 2
): string {
  const pkoin = formatPkoinFromSmallestUnits(balanceInSmallestUnits)

  if (pkoin === 0) {
    return '0'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(pkoin)
}

/**
 * Конвертирует PKOIN обратно в минимальные единицы
 *
 * @param pkoin - Баланс в PKOIN (число)
 * @returns Баланс в минимальных единицах (число)
 *
 * @example
 * formatSmallestUnitsFromPkoin(10.12959685) // 1012959685
 */
export function formatSmallestUnitsFromPkoin(pkoin: number): number {
  if (isNaN(pkoin) || pkoin === 0) {
    return 0
  }

  return Math.round(pkoin * PKOIN_DIVISOR)
}
