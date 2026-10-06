/**
 * Composable: пагинированная загрузка remote registry (RPC `getapps`) + поиск.
 *
 * Используется в `mini-apps-grid.vue` для отображения каталога. Локальное
 * состояние (массив страниц + текущая page) — манипулирует напрямую, без
 * Vue Query: getapps достаточно lightweight и редко перезапрашивается.
 *
 * Сначала популярные: нода сортирует по рейтингу. Фильтр — по понятным
 * разделам (`catalog/categories.ts`), а не по сырым тегам авторов.
 *
 * Дебаунс на ввод поиска — 400 мс (как в legacy).
 */

import { computed, onMounted, ref, watch } from 'vue'
import { RemoteAppsLoader, type RemoteAppEntry } from '@/mini-apps/registry/remote-registry'
import {
  MINI_APP_CATEGORIES,
  categoriesOfTags,
  categoryQueryTags,
  type MiniAppCategoryId,
} from '@/mini-apps/catalog/categories'
import { getCatalogLoader } from '@/mini-apps/catalog/catalog-loader'
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
  /** Выбранный раздел. Пусто — весь каталог. */
  const activeCategory = ref<MiniAppCategoryId | null>(null)
  // Разделы, в которых нашлось хоть одно загруженное приложение. Копятся,
  // чтобы чипы не пропадали при переключении фильтра.
  const seenCategories = ref<Set<MiniAppCategoryId>>(new Set())

  /** Разделы для чипов фильтра — в порядке MINI_APP_CATEGORIES. */
  const availableCategories = computed<MiniAppCategoryId[]>(() =>
    MINI_APP_CATEGORIES.map((c) => c.id).filter((id) => seenCategories.value.has(id))
  )

  function accumulateCategories(apps: RemoteAppEntry[]): void {
    const next = new Set(seenCategories.value)
    for (const app of apps) {
      for (const id of categoriesOfTags(app.tags ?? [])) next.add(id)
    }
    seenCategories.value = next
  }

  const getLoader = (): Promise<RemoteAppsLoader> =>
    opts.rpc ? Promise.resolve(new RemoteAppsLoader(opts.rpc)) : getCatalogLoader()

  const loadPage = async (reset: boolean): Promise<void> => {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null
    const startedFor = search.value
    const offset = reset ? 0 : pageStart.value

    try {
      const startedCategory = activeCategory.value
      const loader = await getLoader()
      const page = await loader.load({
        pageStart: offset,
        pageSize,
        search: search.value,
        tags: startedCategory ? categoryQueryTags(startedCategory) : [],
        orderBy: 'rating',
        orderDesc: true,
      })

      // Если за время запроса search/фильтр изменились — отбрасываем результат
      if (startedFor !== search.value || startedCategory !== activeCategory.value) return

      accumulateCategories(page.apps)

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

  /** Переключить раздел (повторный клик — снять). */
  function toggleCategory(id: MiniAppCategoryId): void {
    activeCategory.value = activeCategory.value === id ? null : id
  }

  // Смена раздела — сброс пагинации и перезагрузка с серверным фильтром.
  watch(activeCategory, () => {
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
    activeCategory,
    availableCategories,
    toggleCategory,
  }
}
