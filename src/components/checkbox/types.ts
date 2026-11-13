export interface CheckboxProps {
  checked?: boolean
  disabled?: boolean
}

export interface CheckboxEmits {
  (e: 'update:checked', checked: boolean): void
  (e: 'change', checked: boolean): void
}
