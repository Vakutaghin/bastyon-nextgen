export interface InputSearchProps {
  value?: string
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
  /** Идёт поиск: в кнопке крутится значок, Enter и кнопка не ищут. */
  loading?: boolean
  maxlength?: number
}

export interface InputSearchEmits {
  (e: 'update:value', value: string): void
  /** Enter или кнопка — с текстом поля; крестик — с пустой строкой, как у antd. */
  (e: 'search', value: string): void
  (e: 'clear'): void
}
