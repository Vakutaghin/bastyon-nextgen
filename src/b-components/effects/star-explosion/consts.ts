// Конфигурация частиц для эффекта взрыва звёзд (PixiJS)

export const PARTICLE_CONFIG = {
  /** Количество частиц в одном взрыве */
  COUNT: 20,
  /** Минимальный масштаб частицы */
  SCALE_MIN: 0.5,
  /** Максимальный масштаб */
  SCALE_MAX: 1.0,
  /** Минимальная скорость разлёта */
  SPEED_MIN: 2,
  /** Максимальная скорость */
  SPEED_MAX: 8,
  /** Минимальная скорость затухания */
  DECAY_MIN: 0.01,
  /** Максимальная скорость затухания */
  DECAY_MAX: 0.03,
  /** Множитель скорости вращения */
  ROTATION_SPEED: 0.2,
  /** Сила гравитации */
  GRAVITY: 0.15,
} as const

/** Параметры формы звезды */
export const STAR_SHAPE = {
  POINTS: 5,
  OUTER_RADIUS: 10,
  INNER_RADIUS: 5,
  FILL_COLOR: 0xffd700,
  STROKE_COLOR: 0xffaa00,
} as const
