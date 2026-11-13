export interface ProgressProps {
  /** Заполнено, 0–100; вне диапазона — прижимается к краю. */
  percent?: number
  /** Число процентов справа от полосы. */
  showInfo?: boolean
  /** `active` — по заполнению бежит блик: работа идёт. */
  status?: 'normal' | 'active'
  /** Толщина: 8px, маленькая — 6px. */
  size?: 'default' | 'small'
}
