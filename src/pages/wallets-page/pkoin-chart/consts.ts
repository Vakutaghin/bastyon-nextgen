// Константы графика PKOIN

/** URL API CoinGecko для данных о цене */
export const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/coins/pocketcoin/market_chart'

/**
 * Варианты периодов для отображения графика. `labelKey` — i18n-ключ домена
 * `labels`; резолвится через t(...) в потребляющем компоненте.
 */
export const PERIOD_OPTIONS = [
  { value: 1, labelKey: 'labels.pkoinChartPeriod1d' },
  { value: 7, labelKey: 'labels.pkoinChartPeriod7d' },
  { value: 30, labelKey: 'labels.pkoinChartPeriod30d' },
  { value: 90, labelKey: 'labels.pkoinChartPeriod3m' },
  { value: 180, labelKey: 'labels.pkoinChartPeriod6m' },
  { value: 365, labelKey: 'labels.pkoinChartPeriod12m' },
] as const

/** Отступы графика (пиксели) */
export const CHART_MARGINS = {
  top: 12,
  right: 12,
  bottom: 24,
  left: 48,
} as const

/** Цвета графика */
export const CHART_COLORS = {
  LINE: '#00A3F7',
  STROKE_WIDTH: 2,
} as const

/** Количество делений осей */
export const AXIS_TICKS = {
  X: 5,
  Y: 5,
} as const

/** Размеры тултипа */
export const TOOLTIP = {
  WIDTH: 120,
  HEIGHT: 36,
  PADDING: 8,
} as const

/** Множитель для отступа по Y-оси */
export const Y_AXIS_PADDING = 0.05

/** Минимальный отступ по Y-оси */
export const Y_AXIS_MIN_PADDING = 0.01

/** 24 часа в миллисекундах */
export const MS_PER_DAY = 24 * 60 * 60 * 1000
