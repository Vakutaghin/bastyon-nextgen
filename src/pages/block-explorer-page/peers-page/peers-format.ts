/**
 * Форматтеры таблицы пиров. Вынесены из SFC, чтобы покрыть тестами (S68).
 */

/** `/Satoshi:0.22.21/` → `Satoshi 0.22.21`. */
export function shortenVersion(v: string): string {
  const m = (v || '').match(/^\/?([A-Za-z]+):([\d.]+)\/?$/)
  return m ? `${m[1]} ${m[2]}` : v
}

/**
 * Подпись пинга. `getpeerinfo.pingtime` у Core — СЕКУНДЫ с дробью (0.055),
 * а не микросекунды: деление на 1000 давало «0.0 ms» у всех пиров (S68).
 *
 * `emptyLabel` — что показать, когда пинга нет (прочерк из i18n).
 */
export function pingLabel(seconds: number, emptyLabel: string): string {
  if (!seconds || seconds < 0 || !Number.isFinite(seconds)) return emptyLabel
  const ms = seconds * 1000
  if (ms < 10) return `${ms.toFixed(1)} ms`
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}
