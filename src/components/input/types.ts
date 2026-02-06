export interface InputProps {
  size?: 'large' | 'middle' | 'small'
  disabled?: boolean
  placeholder?: string
  value?: string
  defaultValue?: string
  allowClear?: boolean
  prefix?: any
  suffix?: any
  addonBefore?: any
  addonAfter?: any
  type?: string
  maxLength?: number
}
