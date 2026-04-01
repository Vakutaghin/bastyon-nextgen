// Константы компонента sidebar-tags

/** Количество тегов для API-запроса */
export const TAG_FETCH_COUNT = 100

/** Максимальное количество тегов в свёрнутом виде */
export const TAGS_DISPLAY_LIMIT = 7

/** Время кэширования тегов (мс) — 5 минут */
export const TAGS_STALE_TIME = 5 * 60 * 1000

/** Время жизни кэша тегов (мс) — 10 минут */
export const TAGS_GC_TIME = 10 * 60 * 1000

/** Порог для форматирования числа с суффиксом K */
export const FORMAT_THRESHOLD_K = 1000
