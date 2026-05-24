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

const RELATIVE_TIME_UNITS: Array<[label: string, seconds: number]> = [
  ['год', 365 * 24 * 3600],
  ['мес', 30 * 24 * 3600],
  ['д', 24 * 3600],
  ['ч', 3600],
  ['мин', 60],
  ['с', 1],
]

/** «5 мин назад», «2 ч назад» и т.д. Без зависимостей. */
export function formatRelativeTime(unixSeconds: number, nowSeconds: number = Math.floor(Date.now() / 1000)): string {
  const diff = nowSeconds - unixSeconds
  if (diff < 0) return 'только что'
  if (diff < 5) return 'только что'
  for (const [label, secs] of RELATIVE_TIME_UNITS) {
    if (diff >= secs) {
      const n = Math.floor(diff / secs)
      return `${n} ${label} назад`
    }
  }
  return 'только что'
}

export function formatAbsoluteTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
