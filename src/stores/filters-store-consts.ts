// Константы стора фильтров.

/** Ключ в IDB settings, в котором персистится снимок состояния фильтров. */
export const FILTERS_SETTINGS_KEY = 'sidebarFilters'

/** Маппинг параметра feedMode из URL → ID вкладки. */
export const FEED_MODE_TO_TAB_ID: Record<string, number> = {
  subscriptions: 2,
  video: 3,
  audio: 4,
  article: 5,
  favorites: 6,
  discussed: 7,
  all: 1,
}

/**
 * Маппинг ID активного фильтра сортировки → значение orderby для RPC.
 *  1 (По популярности) → 'score'
 *  2 (По дате) → 'id'
 *  3 (По рейтингу) → 'score'
 *  4 (По комментариям) → 'comment'
 */
export const SORT_FILTER_MAP: Record<number, string> = {
  1: 'score',
  2: 'id',
  3: 'score',
  4: 'comment',
}

/** Префикс ID кастомных категорий (пользовательских, персистятся). */
export const CUSTOM_CATEGORY_PREFIX = 'custom_'

/** Префикс ID временных категорий (создаются по клику на тег в посте, не персистятся). */
export const TEMP_CATEGORY_PREFIX = 'temp_'

/** Иконка кастомной категории. */
export const CUSTOM_CATEGORY_ICON = '⭐'

/** Иконка временной категории. */
export const TEMP_CATEGORY_ICON = '⚡'
