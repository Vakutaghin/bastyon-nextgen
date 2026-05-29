// Дизайн-токены: единые размеры, отступы, брейкпоинты, анимации
// Архитектура: статические токены (десктопный baseline) + fluid helpers (clamp)
// для плавной адаптации к мобилке. См. также src/style.css — там CSS-переменные
// автоматически перекрываются на mobile через @media.

export const SPACING = {
  XS: '4px',
  SM: '8px',
  MD: '16px',
  LG: '24px',
  XL: '32px',
  XXL: '48px',
} as const

// Mobile-уменьшенная шкала — используется в styled-components,
// где нельзя положиться на CSS-переменные (например, прямые значения в JS-логике).
export const MOBILE_SPACING = {
  XS: '2px',
  SM: '6px',
  MD: '12px',
  LG: '16px',
  XL: '20px',
  XXL: '32px',
} as const

export const BORDER_RADIUS = {
  SM: '4px',
  MD: '8px',
  LG: '12px',
  XL: '16px',
  ROUND: '50%',
} as const

export const BREAKPOINTS = {
  SMALL_MOBILE: '360px',
  MOBILE: '480px',
  TABLET: '768px',
  DESKTOP: '1200px',
  WIDE: '1600px',
  WIDE_XL: '1920px',
} as const

// Числовые версии — для расчётов в JS (например, window.innerWidth сравнение)
export const BREAKPOINT_VALUES = {
  SMALL_MOBILE: 360,
  MOBILE: 480,
  TABLET: 768,
  DESKTOP: 1200,
  WIDE: 1600,
  WIDE_XL: 1920,
} as const

export const TRANSITIONS = {
  // QUICK — мгновенный визуальный отклик (hover/focus в block-explorer, settings, sidebar).
  // FAST — стандартные UI-переходы (открытие тостов, smooth-scrolling).
  // NORMAL — крупные перестроения (модалки, выпадашки).
  // SLOW — заметные переходы между состояниями.
  // CUBIC — фирменный кривой ease для главных переключений.
  QUICK: '0.15s ease',
  FAST: '0.2s ease',
  NORMAL: '0.3s ease',
  SLOW: '0.5s ease',
  CUBIC: '0.3s cubic-bezier(0.645, 0.045, 0.355, 1)',
} as const

export const Z_INDEX = {
  // Локальные слои внутри секции — выше соседнего контента, ниже глобальных оверлеев.
  LOCAL_DROPDOWN: 10,
  LOCAL_DROPDOWN_HIGH: 100,
  // Mini-apps iframe — выше обычного контента, ниже messenger-виджета.
  MINIAPP_FRAME: 500,
  MINIAPP_PETAL: 600,
  DROPDOWN: 1000,
  STICKY: 1020,
  MODAL_BACKDROP: 1040,
  MODAL: 2000,
  TOAST: 3000,
  TOOLTIP: 4000,
  REACTION_PICKER: 10000,
} as const

export const FONT_SIZE = {
  XS: '11px',
  SM: '12px',
  MD: '14px',
  LG: '16px',
  XL: '18px',
  XXL: '24px',
  HEADING: '20px',
} as const

// Layout-константы — высоты ключевых элементов каркаса.
// Дублируются в style.css как CSS-переменные (--header-height, --bottom-nav-height).
export const LAYOUT = {
  HEADER_HEIGHT: '60px',
  HEADER_HEIGHT_MOBILE: '52px',
  BOTTOM_NAV_HEIGHT: '56px',
  SIDEBAR_LEFT_WIDTH: '280px',
  SIDEBAR_LEFT_COLLAPSED_WIDTH: '64px',
  SIDEBAR_RIGHT_WIDTH: '320px',
  MAX_CONTENT_WIDTH: '1600px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Fluid helpers — clamp(min, preferred, max) для плавной адаптации
// Принцип: значение растёт линейно между viewport-границами,
// не нужно множество @media-queries.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Создаёт fluid-значение, линейно интерполирующееся от minPx до maxPx
 * по мере роста viewport от minVw до maxVw.
 *
 * @example fluid(12, 20, 480, 1200) → растёт с 12px на 480vw до 20px на 1200vw
 */
export function fluid(
  minPx: number,
  maxPx: number,
  minVw: number = BREAKPOINT_VALUES.MOBILE,
  maxVw: number = BREAKPOINT_VALUES.DESKTOP
): string {
  const slope = (maxPx - minPx) / (maxVw - minVw)
  const intercept = minPx - slope * minVw
  const preferredVw = (slope * 100).toFixed(4)
  const interceptPx = intercept.toFixed(2)
  const sign = intercept >= 0 ? '+' : '-'
  return `clamp(${minPx}px, ${preferredVw}vw ${sign} ${Math.abs(Number(interceptPx))}px, ${maxPx}px)`
}

// Готовые fluid-токены для самых частых случаев — паддинги, отступы, шрифты.
// Используй FLUID_SPACING.MD вместо SPACING.MD там, где хочешь плавность
// без писания @media-queries.
export const FLUID_SPACING = {
  XS: fluid(2, 4),
  SM: fluid(6, 8),
  MD: fluid(10, 16),
  LG: fluid(14, 24),
  XL: fluid(20, 32),
  XXL: fluid(28, 48),
} as const

export const FLUID_FONT_SIZE = {
  XS: fluid(10, 11),
  SM: fluid(11, 12),
  MD: fluid(13, 14),
  LG: fluid(14, 16),
  XL: fluid(16, 18),
  XXL: fluid(20, 24),
  HEADING: fluid(17, 20),
} as const
