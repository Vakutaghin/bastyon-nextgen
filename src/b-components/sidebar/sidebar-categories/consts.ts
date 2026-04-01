// Константы компонента sidebar-categories

/** Базовое количество категорий в свёрнутом виде */
export const BASE_VISIBLE_CATEGORIES = 4

/** Максимальное количество категорий в свёрнутом виде */
export const MAX_COLLAPSED_CATEGORIES = 10

/** Количество тегов для API-запроса */
export const TAG_FETCH_COUNT = '50'

/** Время кэширования тегов (мс) */
export const TAGS_STALE_TIME = 5 * 60 * 1000

/** Префикс для ID кастомных категорий */
export const CUSTOM_CATEGORY_PREFIX = 'custom_'

/** Префикс для ID временных категорий */
export const TEMP_CATEGORY_PREFIX = 'temp_'

/** Иконка кастомной категории */
export const CUSTOM_CATEGORY_ICON = '⭐'

/** Иконка временной категории */
export const TEMP_CATEGORY_ICON = '⚡'
