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

/**
 * Маппинг ID активного фильтра времени → окно `depth` (в днях) для ленты «Лучшее»
 * (`gettopfeed`). В legacy depth измеряется в днях (см. комментарий
 * `//30 is a month depth` в `components/lenta/index.js`; рекомендации используют
 * depth 7000/10000 ≈ all-time).
 *  1 (Сегодня) → 1 день
 *  2 (Неделя)  → 7 дней
 *  3 (Месяц)   → 30 дней   ← дефолт активного фильтра
 *  4 (Год)     → 365 дней
 *  5 (Всё время) → 99999 дней
 */
export const TIME_FILTER_DEPTH_MAP: Record<number, number> = {
  1: 1,
  2: 7,
  3: 30,
  4: 365,
  5: 99999,
}

/** Дефолтный `depth` (дни) для «Лучшее», если активный фильтр времени неизвестен. */
export const DEFAULT_TOP_FEED_DEPTH = 30

/** Префикс ID кастомных категорий (пользовательских, персистятся). */
export const CUSTOM_CATEGORY_PREFIX = 'custom_'

/** Префикс ID временных категорий (создаются по клику на тег в посте, не персистятся). */
export const TEMP_CATEGORY_PREFIX = 'temp_'

/** Иконка кастомной категории. */
export const CUSTOM_CATEGORY_ICON = '⭐'

/** Иконка временной категории. */
export const TEMP_CATEGORY_ICON = '⚡'
