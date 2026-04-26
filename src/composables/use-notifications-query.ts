/**
 * Composable для загрузки нотификаций через Vue Query.
 * Заменяет ручной retry-цикл и setInterval-polling в notifications-store.
 */

import { computed } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/blockchain'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import type { GetMissedInfoParameters } from '@/types/rpc-requests/get-missed-info'
import { useNotificationsStore } from '@/stores/notifications-store'

const NOTIFICATIONS_POLL_INTERVAL_MS = 30_000

/**
 * Проверяет, является ли ошибка временной (таймаут, 500, 408).
 */
function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const o = err as Record<string, unknown>
  const code = o?.code ?? (o?.error && typeof o.error === 'object' && (o.error as Record<string, unknown>)?.code)
  const msg = String(o?.message ?? (o?.error && typeof o.error === 'object' && (o.error as Record<string, unknown>)?.message) ?? '')
  return code === 408 || code === 500 || /timeout/i.test(msg)
}

/**
 * Composable для периодического опроса уведомлений (getmissedinfo).
 *
 * Использует Vue Query для:
 * - Автоматического retry при таймаутах (до 2 повторов)
 * - Polling каждые 30 секунд
 * - Дедупликации запросов
 *
 * @example
 * ```ts
 * // В компоненте или main.ts:
 * const { isLoading, error } = useNotificationsQuery()
 * ```
 */
export function useNotificationsQuery() {
  const authStore = useAuthStore()
  const notificationsStore = useNotificationsStore()
  const queryClient = useQueryClient()

  const address = computed(() => authStore.getUserAddress)
  const isAuthenticated = computed(() => authStore.isUserAuthenticated)

  const query = useQuery({
    queryKey: ['notifications', 'missed-info', address],
    queryFn: async () => {
      const addr = address.value
      if (!addr) throw new Error('Not authenticated')

      // Инициализируем стор если нужно (загрузка из IDB)
      if (!notificationsStore.inited) {
        await notificationsStore.init()
      }

      const blockToRequest = notificationsStore.lastBlock || 0
      const params: GetMissedInfoParameters = [addr, blockToRequest, 30]

      const raw = await getByPRCWithAuth({
        method: rpcEndpoints.getMissedInfo,
        parameters: params,
        options: { cache: false },
      }) as unknown

      return raw
    },
    enabled: isAuthenticated,
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: NOTIFICATIONS_POLL_INTERVAL_MS / 2,
    retry: (failureCount, error) => {
      return failureCount < 2 && isRetryableError(error)
    },
    retryDelay: 2000,
  })

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  }
}
