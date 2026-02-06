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

  const balance = typeof balanceInSmallestUnits === 'string' 
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
