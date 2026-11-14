export type InputStatus = 'error' | 'warning'

/** Общее у однострочного поля и TextArea. */
export interface FieldProps {
  value?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  autofocus?: boolean
  /** Рамка ошибки или предупреждения; у ошибки ещё aria-invalid. */
  status?: InputStatus
  /** Счётчик «набрано / maxlength». */
  showCount?: boolean
  maxlength?: number
}

export interface InputProps extends FieldProps {
  type?: string
  /** Крестик, который стирает поле. */
  allowClear?: boolean
}

export interface InputEmits {
  (e: 'update:value', value: string): void
  /** Enter (не во время набора через IME), как у antd. */
  (e: 'pressEnter', event: KeyboardEvent): void
  /** Поле стёрто крестиком (после update:value с пустой строкой). */
  (e: 'clear'): void
}

/** Методы через ref, как у antd: фокус из окна после открытия. */
export interface InputExpose {
  focus: () => void
  blur: () => void
  select: () => void
}
