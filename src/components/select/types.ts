export type SelectValue = string | number

/** Пункт списка. */
export interface SelectOption {
  value: SelectValue
  label: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  /** В режиме multiple — список выбранных. Пусто (`undefined`, `null`) — подсказка. */
  value?: SelectValue | SelectValue[] | null
  /** multiple — выбор нескольких: список не закрывается, пункт отмечается и снимается. */
  mode?: 'multiple'
  /**
   * large — 36px, как поля ввода в формах (по умолчанию); middle — 32px, для
   * строки с текстом (сортировка комментариев).
   */
  size?: 'large' | 'middle'
  disabled?: boolean
  placeholder?: string
  /** Текст пустого списка. По умолчанию — «Нет данных». */
  notFoundContent?: string
  /**
   * Список шириной с поле (по умолчанию). `false` — не уже поля, но длинные
   * подписи раздвигают его.
   */
  dropdownMatchSelectWidth?: boolean
  /**
   * Текст в поле при выборе нескольких. По умолчанию — подписи через запятую.
   */
  formatValue?: (values: SelectValue[]) => string
}

export interface SelectEmits {
  (e: 'update:value', value: SelectValue | SelectValue[]): void
  (e: 'change', value: SelectValue | SelectValue[], option: SelectOption): void
}
