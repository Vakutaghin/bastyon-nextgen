// Константы стора фильтров

/** Маппинг параметра feedMode из URL → ID вкладки */
export const FEED_MODE_TO_TAB_ID: Record<string, number> = {
  subscriptions: 2,
  video: 3,
  audio: 4,
  article: 5,
  favorites: 6,
  discussed: 7,
  all: 1,
}

/** Маппинг ID фильтра сортировки → значение для API */
export const SORT_FILTER_MAP: Record<number, string> = {
  1: 'score',
  2: 'id',
  3: 'comment',
  4: 'score',
}

/** Префикс ID кастомных категорий */
export const CUSTOM_CATEGORY_PREFIX = 'custom_'

/** Префикс ID временных категорий */
export const TEMP_CATEGORY_PREFIX = 'temp_'

/** Иконка кастомной категории */
export const CUSTOM_CATEGORY_ICON = '⭐'

/** Иконка временной категории */
export const TEMP_CATEGORY_ICON = '⚡'
