// Дизайн-токены: единые размеры, отступы, брейкпоинты, анимации

export const SPACING = {
  XS: '4px',
  SM: '8px',
  MD: '16px',
  LG: '24px',
  XL: '32px',
  XXL: '48px',
} as const

export const BORDER_RADIUS = {
  SM: '4px',
  MD: '8px',
  LG: '12px',
  XL: '16px',
  ROUND: '50%',
} as const

export const BREAKPOINTS = {
  MOBILE: '560px',
  TABLET: '800px',
  DESKTOP: '1200px',
  WIDE: '1600px',
} as const

export const TRANSITIONS = {
  FAST: '0.2s ease',
  NORMAL: '0.3s ease',
  SLOW: '0.5s ease',
  CUBIC: '0.3s cubic-bezier(0.645, 0.045, 0.355, 1)',
} as const

export const Z_INDEX = {
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
