// Константы графика PKOIN

/** URL API CoinGecko для данных о цене */
export const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/coins/pocketcoin/market_chart'

/** Варианты периодов для отображения графика */
export const PERIOD_OPTIONS = [
  { value: 1, label: '1 день' },
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '3 мес.' },
  { value: 180, label: '6 мес.' },
  { value: 365, label: '12 мес.' },
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
