import type { FieldProps } from '../input/types'

export interface AutoSizeRows {
  minRows?: number
  maxRows?: number
}

export interface TextAreaProps extends FieldProps {
  /** Высота по содержимому: true — от одной строки без предела, иначе в пределах строк. */
  autoSize?: boolean | AutoSizeRows
}

export interface TextAreaEmits {
  (e: 'update:value', value: string): void
}
