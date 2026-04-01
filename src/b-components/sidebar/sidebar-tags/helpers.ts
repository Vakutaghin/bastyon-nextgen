// Хелперы компонента sidebar-tags

import { FORMAT_THRESHOLD_K } from './consts'

/**
 * Форматирует число постов тега: "1234" → "1.2K".
 */
export function formatTagCount(count: number): string {
  if (count >= FORMAT_THRESHOLD_K) {
    return (count / FORMAT_THRESHOLD_K).toFixed(1) + 'K'
  }
  return String(count)
}
