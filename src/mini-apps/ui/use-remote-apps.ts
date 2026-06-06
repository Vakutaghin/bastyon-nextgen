/**
 * Composable: пагинированная загрузка remote registry (RPC `getapps`) + поиск.
 *
 * Используется в `mini-apps-grid.vue` для отображения каталога. Локальное
 * состояние (массив страниц + текущая page) — манипулирует напрямую, без
 * Vue Query: getapps достаточно lightweight и редко перезапрашивается.
 *
 * Дебаунс на ввод поиска — 400 мс (как в legacy).
 */

import { computed, onMounted, ref, watch } from 'vue'
import { RemoteAppsLoader, type RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import { logger } from '@/services/logger'

const log = logger.scope('[mini-apps:remote-ui]')

const DEFAULT_PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 400
/** Сколько категорий-чипов показывать (топ по частоте среди загруженных аппов). */
const MAX_CATEGORY_CHIPS = 12

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
  /** Активный фильтр по категории (тегу). Пусто — без фильтра. */
  const activeTag = ref<string | null>(null)
  // Частоты тегов среди всех загруженных аппов (накапливаем, чтобы чипы были
  // стабильны при переключении фильтра). tag → count.
  const tagCounts = ref<Map<string, number>>(new Map())

  /** Топ категорий по частоте — для чипов фильтра. */
  const availableTags = computed<string[]>(() =>
    [...tagCounts.value.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_CATEGORY_CHIPS)
      .map(([tag]) => tag)
  )

  function accumulateTags(apps: RemoteAppEntry[]): void {
    const counts = tagCounts.value
    for (const app of apps) {
      for (const raw of app.tags ?? []) {
        const tag = String(raw).trim().toLowerCase()
        if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    // Триггерим реактивность (Map мутируется на месте).
    tagCounts.value = new Map(counts)
  }

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
      const startedTag = activeTag.value
      const loader = await getLoader()
      const page = await loader.load({
        pageStart: offset,
        pageSize,
        search: search.value,
        tags: activeTag.value ? [activeTag.value] : [],
      })

      // Если за время запроса search/фильтр изменились — отбрасываем результат
      if (startedFor !== search.value || startedTag !== activeTag.value) return

      accumulateTags(page.apps)

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

  /** Переключить фильтр по категории (повторный клик — снять). */
  function toggleTag(tag: string): void {
    activeTag.value = activeTag.value === tag ? null : tag
  }

  // Смена категории — сброс пагинации и перезагрузка с серверным фильтром.
  watch(activeTag, () => {
    pageStart.value = 0
    hasMore.value = true
    void loadPage(true)
  })

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
    activeTag,
    availableTags,
    toggleTag,
  }
}
