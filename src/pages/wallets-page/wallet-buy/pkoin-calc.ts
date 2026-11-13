/**
 * Калькулятор вкладки «Покупка/продажа»: PKOIN ⇄ USD по курсу бирж с CoinGecko.
 * У продавцов курс свой — это сказано рядом с полями.
 */

/** Число из поля ввода: запятая тоже разделитель, пробелы не мешают. `null` — не число. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/\s+/g, '').replace(',', '.')
  if (!s || s === '.' || !/^\d*\.?\d*$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Сумма для поля: не больше `digits` знаков после точки, без хвостовых нулей. */
export function formatAmount(value: number, digits: number): string {
  if (!Number.isFinite(value) || value < 0) return ''
  const fixed = value.toFixed(digits)
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed
}

/** Знаков после точки: у PKOIN — до 8 (сатоши), у доллара — центы. */
export const PKOIN_DIGITS = 8
export const USD_DIGITS = 2

export function pkoinToUsd(pkoin: number, price: number): number {
  return pkoin * price
}

export function usdToPkoin(usd: number, price: number): number {
  return price > 0 ? usd / price : 0
}
