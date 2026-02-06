/**
 * Глобальный QueryClient для Vue Query
 * Экспортируется отдельно, чтобы избежать циклических зависимостей
 */

import { QueryClient } from '@tanstack/vue-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Данные считаются свежими 5 минут
      staleTime: 5 * 60 * 1000,
      // Кэш хранится 10 минут после последнего использования
      gcTime: 10 * 60 * 1000,
      // Повторные попытки при ошибках
      retry: 2,
      // Рефетч при фокусе окна
      refetchOnWindowFocus: false,
      // Рефетч при переподключении
      refetchOnReconnect: true,
    },
    mutations: {
      // Повторные попытки для мутаций
      retry: 1,
    },
  },
})
