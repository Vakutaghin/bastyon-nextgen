export type SegmentedValue = string | number

export interface SegmentedOptionObject {
  label: string
  value: SegmentedValue
  disabled?: boolean
}

/** Строка или число — и подпись, и значение. */
export type SegmentedOption = SegmentedValue | SegmentedOptionObject

export interface SegmentedProps {
  options: readonly SegmentedOption[]
  value?: SegmentedValue
  disabled?: boolean
  /** Во всю ширину, варианты поровну. */
  block?: boolean
  size?: 'default' | 'small'
}

export interface SegmentedEmits {
  (e: 'update:value', value: SegmentedValue): void
  (e: 'change', value: SegmentedValue): void
}
