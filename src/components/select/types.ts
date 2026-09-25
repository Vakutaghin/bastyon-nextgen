export type SelectValue = string | number

/** Пункт списка. */
export interface SelectOption {
  value: SelectValue
  label: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: SelectValue
  /**
   * large — 36px, как поля ввода в формах (по умолчанию); middle — 32px, для
   * строки с текстом (сортировка комментариев).
   */
  size?: 'large' | 'middle'
  disabled?: boolean
  placeholder?: string
}
