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

/** Блоков в сутках: у Bastyon целевое время блока — минута. */
export const BLOCKS_PER_DAY = 1440

/**
 * Маппинг ID активного фильтра времени → окно `depth` для ленты «Лучшее»
 * (`gettopfeed`). `depth` у ноды измеряется в БЛОКАХ, не в днях: с depth=30
 * лента отдаёт полчаса цепочки (проба к 1.pocketnet.app:8899 — 14 постов и
 * «всё загружено»), а с месяцем в блоках (43200) запрос падает в
 * `GetTopFeed: sql request timeout`. Отсюда потолок в неделю — столько же
 * просит legacy (depth 7000–10000 в `satolist.js`).
 *  1 (Сегодня)    → 1 сутки
 *  2 (За 3 дня)   → 3 суток
 *  3 (За неделю)  → 7 суток  ← дефолт активного фильтра
 */
export const TIME_FILTER_DEPTH_MAP: Record<number, number> = {
  1: BLOCKS_PER_DAY,
  2: 3 * BLOCKS_PER_DAY,
  3: 7 * BLOCKS_PER_DAY,
}

/** Дефолтный `depth` (блоки) для «Лучшее», если активный фильтр времени неизвестен. */
export const DEFAULT_TOP_FEED_DEPTH = 7 * BLOCKS_PER_DAY

/**
 * Пороги «Репутация авторов» на выбор (свой — любое целое из
 * MIN_REPUTATION_RANGE). У пишущих в ленту репутация обычно тысячи и
 * десятки тысяч (замер 09.11.2026: из 160 русских постов у 108 авторов больше
 * 5000), у новичков — 0 и единицы, отрицательная — у тех, кому ставят плохие
 * оценки. Свой предел у сети тоже есть: совсем плохих нода не отдаёт.
 */
export const REPUTATION_PRESETS: readonly number[] = [0, 10, 100, 1000, 10_000]

/** Свой порог — в пределах, какие бывают у репутации в сети. */
export const MIN_REPUTATION_RANGE = { min: -1000, max: 1_000_000 } as const

/** Иконка кастомной категории. */
export const CUSTOM_CATEGORY_ICON = '⭐'

/** Иконка временной категории. */
export const TEMP_CATEGORY_ICON = '⚡'

/** id убранной категории «Космос» (теги `космос`) — для переноса в свою категорию. */
export const REMOVED_SPACE_CATEGORY_ID = 'c10'
