import type { VNodeChild } from 'vue'

export interface InputProps {
  size?: 'large' | 'middle' | 'small'
  disabled?: boolean
  placeholder?: string
  value?: string
  defaultValue?: string
  allowClear?: boolean
  prefix?: VNodeChild
  suffix?: VNodeChild
  addonBefore?: VNodeChild
  addonAfter?: VNodeChild
  type?: string
  maxLength?: number
}
