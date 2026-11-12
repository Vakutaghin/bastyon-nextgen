/**
 * Включена ли анонимная статистика в этой сборке.
 *
 * Адрес сервера в коде не хранится: его задают при сборке,
 * `VITE_USAGE_STATS_URL=https://<сервер>:8460/beat` (stats-server/README.md).
 * Пока адреса нет, статистики нет целиком: отметки не уходят, переключателя
 * в настройках нет. Адрес не по HTTPS тоже выключает её.
 */
export function usageStatsUrl(): string {
  const raw: unknown = import.meta.env.VITE_USAGE_STATS_URL
  const url = typeof raw === 'string' ? raw.trim() : ''
  return url.startsWith('https://') ? url : ''
}

export function usageStatsEnabled(): boolean {
  return usageStatsUrl() !== ''
}
