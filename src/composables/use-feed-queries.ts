/**
 * Composables для работы с лентой постов через Vue Query
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useRpcQueryWithAuth } from './use-rpc-query'
import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import type { GetTopFeedResponse } from '@/types/rpc-responses/get-top-feed'
import type { GetProfileFeedResponse } from '@/types/rpc-responses/get-profile-feed'
import type { GetProfileFeedParameters } from '@/types/rpc-requests/get-profile-feed'
import { extractPostsFromResponse } from './use-feed'
import { useFiltersStore } from '@/stores/filters-store'
import { getByPRCWithAuth } from '@/helpers/api/request'

/**
 * Загружает hierarchical strip (основная лента)
 *
 * @param offset - Смещение для пагинации
 * @param limit - Количество постов
 * @param enabled - Включен ли запрос
 *
 * @example
 * ```vue
 * const { data, posts, isLoading } = useHierarchicalStrip(0, 20)
 * ```
 */
export function useHierarchicalStrip(
  offset: number = 0,
  limit: number = 20,
  enabled: boolean = true
) {
  const authStore = useAuthStore()
  const address = computed(() => authStore.address)

  const { data, isLoading, error, refetch } = useRpcQueryWithAuth<GetHierarchicalStripResponse>(
    ['feed', 'hierarchical-strip', offset, limit, address],
    {
      method: 'gethierarchicalstrip',
      parameters: [offset, '', limit, 'ru', [], [], [], [], []],
      cachehash: Date.now().toString(36) + Math.random().toString(36).substr(2),
      options: {
        ex: true,
        auth: true
      },
      state: 1
    },
    {
      enabled,
      staleTime: 2 * 60 * 1000, // 2 минуты - данные ленты быстро устаревают
      gcTime: 5 * 60 * 1000,
    }
  )

  // Адаптированные посты
  const posts = computed(() => extractPostsFromResponse(data.value))

  return {
    data,
    posts,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Загружает top feed
 *
 * @param offset - Смещение для пагинации
 * @param limit - Количество постов
 * @param enabled - Включен ли запрос
 */
export function useTopFeed(
  offset: number = 0,
  limit: number = 20,
  enabled: boolean = true
) {
  const authStore = useAuthStore()
  const address = computed(() => authStore.address)

  const { data, isLoading, error, refetch } = useRpcQueryWithAuth<GetTopFeedResponse>(
    ['feed', 'top-feed', offset, limit, address],
    {
      method: 'gettopfeed',
      parameters: [offset, limit],
      cachehash: Date.now().toString(36) + Math.random().toString(36).substr(2),
      options: {
        // Убираем auth: false, чтобы разрешить подпись запроса при наличии авторизации
      }
    },
    {
      enabled,
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
    }
  )

  const posts = computed(() => extractPostsFromResponse(data.value))

  return {
    data,
    posts,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Загружает ленту профиля пользователя
 *
 * @param address - Адрес пользователя
 * @param offset - Смещение для пагинации (используется как txid для пагинации)
 * @param limit - Количество постов
 * @param enabled - Включен ли запрос
 * @param orderby - Поле для сортировки ('id', 'comment', 'score', '' = по умолчанию)
 * @param ascdesc - Направление сортировки ('asc' или 'desc')
 */
export function useProfileFeed(
  address: string | null | undefined,
  offset: number = 0,
  limit: number = 20,
  enabled: boolean = true,
  orderby: string = '',
  ascdesc: 'asc' | 'desc' = 'desc'
) {
  // Формируем правильный массив параметров согласно GetProfileFeedParameters
  const parameters: GetProfileFeedParameters = address ? [
    0,              // height - высота блока (0 = последние)
    '',             // txid - ID транзакции для пагинации ('' = с начала, offset не используется напрямую)
    limit,          // count - количество постов
    'ru',           // lang - язык контента
    [],             // tagsfilter - фильтр по тегам
    [],             // type - тип контента
    [],             // пустой параметр
    [],             // пустой параметр
    [],             // tagsexcluded - исключенные теги
    address,        // address - адрес пользователя
    '',             // keyword - ключевое слово для поиска
    orderby,        // orderby - поле для сортировки
    ascdesc         // ascdesc - направление сортировки
  ] : [] as any

  const { data, isLoading, error, refetch } = useRpcQueryWithAuth<GetProfileFeedResponse>(
    ['feed', 'profile', address || '', offset, limit, orderby, ascdesc],
    {
      method: 'getprofilefeed',
      parameters,
      cachehash: Date.now().toString(36) + Math.random().toString(36).substr(2),
      options: {
        // auth: false, // Разрешаем авторизацию
        ex: true  // Используем rpc-ex эндпоинт
      }
    },
    {
      enabled: enabled && !!address,
      staleTime: 3 * 60 * 1000, // 3 минуты
      gcTime: 10 * 60 * 1000,
    }
  )

  const posts = computed(() => extractPostsFromResponse(data.value))

  return {
    data,
    posts,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Загружает ленту профиля пользователя с автоматическим использованием фильтров из store
 *
 * Этот composable автоматически читает параметры сортировки из filtersStore и обновляет запрос
 * при изменении фильтров. Использует computed значения для реактивности в query key.
 *
 * @param address - Адрес пользователя
 * @param offset - Смещение для пагинации
 * @param limit - Количество постов
 * @param enabled - Включен ли запрос
 *
 * @example
 * ```vue
 * const { data, posts, isLoading } = useProfileFeedWithFilters(address, 0, 20)
 * ```
 */
export function useProfileFeedWithFilters(
  address: string | null | undefined,
  offset: number = 0,
  limit: number = 20,
  enabled: boolean = true
) {
  const filtersStore = useFiltersStore()

  // Используем computed для реактивности - при изменении фильтров query key изменится
  const orderby = computed(() => filtersStore.orderby)
  const ascdesc = computed(() => filtersStore.ascdesc)

  // Формируем правильный массив параметров согласно GetProfileFeedParameters
  const parameters = computed<GetProfileFeedParameters>(() => address ? [
    0,              // height - высота блока (0 = последние)
    '',             // txid - ID транзакции для пагинации ('' = с начала)
    limit,          // count - количество постов
    'ru',           // lang - язык контента
    [],             // tagsfilter - фильтр по тегам
    [],             // type - тип контента
    [],             // пустой параметр
    [],             // пустой параметр
    [],             // tagsexcluded - исключенные теги
    address,        // address - адрес пользователя
    '',             // keyword - ключевое слово для поиска
    orderby.value,  // orderby - поле для сортировки (реактивное)
    ascdesc.value   // ascdesc - направление сортировки (реактивное)
  ] : [] as any)

  // Используем useQuery напрямую для полного контроля над реактивностью
  const { data, isLoading, error, refetch } = useQuery<GetProfileFeedResponse>({
    queryKey: computed(() => ['feed', 'profile', address || '', offset, limit, orderby.value, ascdesc.value]),
    queryFn: () => getByPRCWithAuth({
      method: 'getprofilefeed',
      parameters: parameters.value,
      cachehash: Date.now().toString(36) + Math.random().toString(36).substr(2),
      options: {
        // auth: false,
        ex: true  // Используем rpc-ex эндпоинт
      }
    }) as Promise<GetProfileFeedResponse>,
    enabled: computed(() => enabled && !!address),
    staleTime: 3 * 60 * 1000, // 3 минуты
    gcTime: 10 * 60 * 1000,
  })

  const posts = computed(() => extractPostsFromResponse(data.value))

  return {
    data,
    posts,
    isLoading,
    error,
    refetch,
  }
}
