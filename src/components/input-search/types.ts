import type { VNodeChild } from 'vue'

export interface InputSearchProps {
  size?: 'large' | 'middle' | 'small'
  disabled?: boolean
  placeholder?: string
  value?: string
  defaultValue?: string
  allowClear?: boolean
  enterButton?: boolean | VNodeChild
  loading?: boolean
  onSearch?: (value: string) => void
  maxLength?: number
}
