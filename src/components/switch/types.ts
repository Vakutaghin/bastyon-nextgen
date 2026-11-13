export interface SwitchProps {
  /** Включён. Без него переключатель помнит состояние сам. */
  checked?: boolean
  disabled?: boolean
  /** Идёт сохранение: в бегунке крутится значок, нажать нельзя. */
  loading?: boolean
  /** 40×20 или маленький 28×16. */
  size?: 'default' | 'small'
}

export interface SwitchEmits {
  (e: 'update:checked', checked: boolean): void
  /** Как у antd: новое значение и событие нажатия. */
  (e: 'change', checked: boolean, event: MouseEvent): void
  (e: 'click', checked: boolean, event: MouseEvent): void
}
