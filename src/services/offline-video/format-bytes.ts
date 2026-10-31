// «47 МБ», «1,2 ГБ» — размеры скачанного на языке интерфейса.

const KB = 1024
const MB = KB * 1024
const GB = MB * 1024

/** Коды языков приложения — в теги Intl (`kr` у нас — корейский). */
function intlTag(locale: string): string {
  return locale === 'kr' ? 'ko' : locale
}

export function formatBytes(bytes: number, locale: string): string {
  const n = Math.max(0, bytes || 0)
  const [value, unit, digits] =
    n >= GB
      ? [n / GB, 'gigabyte', 1]
      : n >= MB
        ? [n / MB, 'megabyte', n >= 100 * MB ? 0 : 1]
        : [n / KB, 'kilobyte', 0]
  try {
    return new Intl.NumberFormat(intlTag(locale), {
      style: 'unit',
      unit,
      unitDisplay: 'short',
      maximumFractionDigits: digits as number,
    }).format(value)
  } catch {
    return `${(value as number).toFixed(digits as number)} ${unit === 'gigabyte' ? 'GB' : unit === 'megabyte' ? 'MB' : 'KB'}`
  }
}
