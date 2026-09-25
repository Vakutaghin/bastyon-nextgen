/**
 * Утилиты форматирования для блок-эксплорера.
 *
 * Внимание: explorer RPC уже возвращает значения PKOIN в десятичной форме (например,
 * vin[].value = 0.00001982 PKOIN), а не в минимальных единицах. Поэтому helper-ы
 * из pkoin-formatter.ts здесь НЕ подходят — они делят на 10^8.
 */

const PKOIN_LOCALE = 'en-US'

/** Форматирует значение PKOIN из ответа эксплорера (уже в PKOIN). */
export function formatExplorerPkoin(value: number | null | undefined, maxDecimals = 8): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value === 0) return '0'
  const fixed = value.toFixed(maxDecimals).replace(/\.?0+$/, '')
  // Разделитель тысяч в целой части.
  const [int, frac] = fixed.split('.')
  const intWithSeparators = new Intl.NumberFormat(PKOIN_LOCALE).format(Number(int))
  return frac ? `${intWithSeparators}.${frac}` : intWithSeparators
}

/** Целочисленные значения (high, ntx, emission). */
export function formatExplorerNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(PKOIN_LOCALE).format(value)
}

/** Укорачивает hex-хеш в middle-ellipsis форму: aaaa…ffff. */
export function shortenHash(hash: string, head = 8, tail = 6): string {
  if (!hash) return ''
  if (hash.length <= head + tail + 1) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}
