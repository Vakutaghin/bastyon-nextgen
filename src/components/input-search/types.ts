export interface InputSearchProps {
  size?: 'large' | 'middle' | 'small'
  disabled?: boolean
  placeholder?: string
  value?: string
  defaultValue?: string
  allowClear?: boolean
  enterButton?: boolean | any
  loading?: boolean
  onSearch?: (value: string) => void
  maxLength?: number
}
