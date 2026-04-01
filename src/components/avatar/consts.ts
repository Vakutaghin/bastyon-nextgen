// Константы компонента аватара

/** Размеры аватара в пикселях по типу */
export const AVATAR_SIZES: Record<string, number> = {
  large: 40,
  small: 24,
  default: 32,
} as const

/** Радиусы скругления по форме */
export const AVATAR_BORDER_RADIUS: Record<string, string> = {
  square: '4px',
  circle: '50%',
} as const
