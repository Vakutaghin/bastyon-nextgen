/**
 * Глобальный QueryClient для Vue Query
 * Экспортируется отдельно, чтобы избежать циклических зависимостей
 */

import { QueryClient } from '@tanstack/vue-query'
import { isOfflineError } from '@/helpers/api/offline'

const MINUTE_MS = 60 * 1000
const QUERY_STALE_TIME_MS = 5 * MINUTE_MS
const QUERY_GC_TIME_MS = 10 * MINUTE_MS
const QUERY_RETRY_COUNT = 2
const MUTATION_RETRY_COUNT = 1

/**
 * Повтор упавшего запроса. Без сети не повторяем: OfflineError придёт снова
 * через миг, а экран лишние три секунды ждал бы повторов, прежде чем показать
 * «Нет сети» или сохранённую ленту. Сеть вернётся — повторит слушатель ниже.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return !isOfflineError(error) && failureCount < QUERY_RETRY_COUNT
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      gcTime: QUERY_GC_TIME_MS,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: MUTATION_RETRY_COUNT,
    },
  },
})

// Запрос упал без сети — сеть вернулась, повторяем сами. TanStack повторяет
// при переподключении, только если сам видел «сети нет → есть», а при запуске
// без сети он считает, что сеть есть (onlineManager начинает с true), и лента
// оставалась с ошибкой до нажатия «Повторить».
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void queryClient.refetchQueries(
      { type: 'active', predicate: (query) => query.state.status === 'error' },
      { cancelRefetch: false }
    )
  })
}
