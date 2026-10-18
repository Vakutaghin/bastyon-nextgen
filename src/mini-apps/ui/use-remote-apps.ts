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
 *
 * Следующая страница грузится сразу за текущей, и «Загрузить ещё» видно, только
 * если в ней есть что показать: раньше кнопка была при любой полной странице, и
 * когда приложений было ровно на страницу (или дальше шли одни установленные,
 * которые сетка прячет), нажатие не добавляло ничего.
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
  /**
   * Записи, которые сетка не покажет (уже установленные). Страница из одних
   * таких для кнопки «Загрузить ещё» — пустая: листаем дальше.
   */
  isHidden?: (entry: RemoteAppEntry) => boolean
}

/** Сколько страниц подряд из одних скрытых/повторов пролистать, прежде чем сдаться. */
const MAX_SKIPPED_PAGES = 5

type AheadState = 'idle' | 'loading' | 'ready' | 'error' | 'end'

export function useRemoteApps(opts: UseRemoteAppsOptions = {}) {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE

  const search = ref('')
  const items = ref<RemoteAppEntry[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  /** Выбранный раздел. Пусто — весь каталог. */
  const activeCategory = ref<MiniAppCategoryId | null>(null)
  // Разделы, в которых нашлось хоть одно загруженное приложение. Копятся,
  // чтобы чипы не пропадали при переключении фильтра.
  const seenCategories = ref<Set<MiniAppCategoryId>>(new Set())

  /** Следующая страница, загруженная заранее. */
  const ahead = ref<RemoteAppEntry[]>([])
  const aheadState = ref<AheadState>('idle')
  /** Смещение следующего запроса — по записям ноды, а не по прошедшим нормализацию. */
  let nextOffset = 0
  /** Нода отдала неполную страницу — дальше ничего нет. */
  let endReached = false
  /** Поколение выдачи: смена поиска или раздела отменяет ответы старых запросов. */
  let generation = 0

  /** Есть что дозагрузить: следующая страница с видимыми приложениями уже здесь
   *  (или её не удалось загрузить — тогда кнопка повторит попытку). */
  const hasMore = computed<boolean>(
    () => aheadState.value === 'ready' || aheadState.value === 'error'
  )

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

  const fetchPage = async (offset: number) => {
    const loader = await getLoader()
    const category = activeCategory.value
    return loader.load({
      pageStart: offset,
      pageSize,
      search: search.value,
      tags: category ? categoryQueryTags(category) : [],
      orderBy: 'rating',
      orderDesc: true,
    })
  }

  const isVisible = (entry: RemoteAppEntry): boolean => !opts.isHidden?.(entry)

  /**
   * Следующая страница — заранее. Нода иногда отдаёт пересекающиеся страницы,
   * а установленные приложения сетка прячет: такие записи не в счёт, и если
   * показать нечего, берём страницу дальше.
   */
  const prefetch = async (gen: number): Promise<void> => {
    if (endReached) {
      ahead.value = []
      aheadState.value = 'end'
      return
    }
    aheadState.value = 'loading'
    const collected: RemoteAppEntry[] = []
    try {
      for (let i = 0; i < MAX_SKIPPED_PAGES && !endReached; i++) {
        const page = await fetchPage(nextOffset)
        if (gen !== generation) return
        nextOffset += page.rawCount
        if (!page.hasMore) endReached = true
        accumulateCategories(page.apps)
        const seen = new Set([...items.value, ...collected].map((a) => a.id))
        collected.push(...page.apps.filter((a) => !seen.has(a.id)))
        if (collected.some(isVisible)) break
      }
    } catch (e) {
      if (gen !== generation) return
      log.warn('prefetch failed', e)
      ahead.value = collected
      aheadState.value = 'error'
      return
    }
    ahead.value = collected
    aheadState.value = collected.some(isVisible) ? 'ready' : 'end'
  }

  /** Первая страница выдачи (открытие, поиск, раздел) и сразу — следующая. */
  const loadFirst = async (): Promise<void> => {
    const gen = ++generation
    isLoading.value = true
    error.value = null
    ahead.value = []
    aheadState.value = 'idle'
    nextOffset = 0
    endReached = false
    try {
      const page = await fetchPage(0)
      if (gen !== generation) return
      accumulateCategories(page.apps)
      items.value = page.apps
      nextOffset = page.rawCount
      endReached = !page.hasMore
    } catch (e) {
      if (gen !== generation) return
      log.warn('load failed', e)
      error.value = e instanceof Error ? e : new Error(String(e))
      return
    } finally {
      if (gen === generation) isLoading.value = false
    }
    void prefetch(gen)
  }

  const readAheadState = (): AheadState => aheadState.value

  const loadMore = async (): Promise<void> => {
    if (isLoading.value) return
    const gen = generation
    if (aheadState.value === 'error') {
      // Заранее не загрузилась — пробуем сейчас, человек ждёт.
      isLoading.value = true
      try {
        await prefetch(gen)
      } finally {
        if (gen === generation) isLoading.value = false
      }
      if (gen !== generation) return
    }
    // Состояние читаем заново: prefetch выше его поменял.
    if (readAheadState() !== 'ready') return
    items.value = [...items.value, ...ahead.value]
    ahead.value = []
    void prefetch(gen)
  }

  const refresh = (): Promise<void> => loadFirst()

  /** Переключить раздел (повторный клик — снять). */
  function toggleCategory(id: MiniAppCategoryId): void {
    activeCategory.value = activeCategory.value === id ? null : id
  }

  // Смена раздела — сброс пагинации и перезагрузка с серверным фильтром.
  watch(activeCategory, () => {
    void loadFirst()
  })

  // Дебаунс поиска: каждое изменение откидывает старый таймер.
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  watch(search, () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      void loadFirst()
    }, SEARCH_DEBOUNCE_MS)
  })

  onMounted(() => {
    void loadFirst()
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
