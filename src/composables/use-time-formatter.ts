/**
 * Vue composable for time/date formatting.
 * Wraps the pure utility functions from helpers/common/date-formatter.ts
 * so components can use them in templates without importing helpers directly.
 *
 * Usage in <script setup>:
 *   const { formatDateTimeFull, formatRelativeTime } = useTimeFormatter()
 *
 * Usage in Options API setup():
 *   return { ...useTimeFormatter() }
 */

import {
  formatRelativeTime,
  formatRelativeTimeMs,
  formatDate,
  formatDateTimeFull,
  formatDateTimeFromString,
} from '@/helpers/common/date-formatter'

export function useTimeFormatter() {
  return {
    formatRelativeTime,
    formatRelativeTimeMs,
    formatDate,
    formatDateTimeFull,
    formatDateTimeFromString,
  }
}
