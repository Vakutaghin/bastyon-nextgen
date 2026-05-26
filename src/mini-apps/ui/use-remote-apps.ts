/**
 * Composable: пагинированная загрузка remote registry (RPC `getapps`) + поиск.
 *
 * Используется в `mini-apps-grid.vue` для отображения каталога. Локальное
 * состояние (массив страниц + текущая page) — манипулирует напрямую, без
 * Vue Query: getapps достаточно lightweight и редко перезапрашивается.
 *
 * Дебаунс на ввод поиска — 400 мс (как в legacy).
 */

import { onMounted, ref, watch } from 'vue'
import { RemoteAppsLoader, type RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import { logger } from '@/services/logger'

const log = logger.scope('[mini-apps:remote-ui]')

const DEFAULT_PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 400

export interface UseRemoteAppsOptions {
  pageSize?: number
  /**
   * Кастомная функция RPC. По умолчанию использует `getByPRC` из `@/helpers/api/request`.
   * Полезно в тестах и для подключения к Tor-aware fetch.
   */
  rpc?: (method: string, parameters: unknown[] | Record<string, unknown>) => Promise<unknown>
}

export function useRemoteApps(opts: UseRemoteAppsOptions = {}) {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE

  const search = ref('')
  const items = ref<RemoteAppEntry[]>([])
  const pageStart = ref(0)
  const hasMore = ref(true)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // Lazy default RPC — иначе getByPRC попадёт в SSR/test-окружение.
  let loaderPromise: Promise<RemoteAppsLoader> | null = null
  const getLoader = (): Promise<RemoteAppsLoader> => {
    if (opts.rpc) return Promise.resolve(new RemoteAppsLoader(opts.rpc))
    if (!loaderPromise) {
      loaderPromise = import('@/helpers/api/request').then(({ getByPRC }) => {
        const rpc = async (method: string, parameters: unknown[] | Record<string, unknown>) => {
          return getByPRC({
            method,
            parameters,
            options: { auth: false },
          } as Parameters<typeof getByPRC>[0])
        }
        return new RemoteAppsLoader(rpc)
      })
    }
    return loaderPromise
  }

  const loadPage = async (reset: boolean): Promise<void> => {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null
    const startedFor = search.value
    const offset = reset ? 0 : pageStart.value

    try {
      const loader = await getLoader()
      const page = await loader.load({
        pageStart: offset,
        pageSize,
        search: search.value,
      })

      // Если за время запроса search изменился — отбрасываем результат
      if (startedFor !== search.value) return

      if (reset) {
        items.value = page.apps
      } else {
        // Дедуп по id внутри текущей коллекции (нода иногда отдаёт пересекающиеся страницы)
        const seen = new Set(items.value.map((a) => a.id))
        items.value = [...items.value, ...page.apps.filter((a) => !seen.has(a.id))]
      }
      pageStart.value = offset + page.apps.length
      hasMore.value = page.hasMore
    } catch (e) {
      log.warn('load failed', e)
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      isLoading.value = false
    }
  }

  const loadMore = (): Promise<void> => {
    if (!hasMore.value) return Promise.resolve()
    return loadPage(false)
  }

  const refresh = (): Promise<void> => loadPage(true)

  // Дебаунс поиска: каждое изменение откидывает старый таймер.
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  watch(search, () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      pageStart.value = 0
      hasMore.value = true
      void loadPage(true)
    }, SEARCH_DEBOUNCE_MS)
  })

  onMounted(() => {
    void loadPage(true)
  })

  return {
    search,
    items,
    hasMore,
    isLoading,
    error,
    loadMore,
    refresh,
  }
}
