export interface DrawerProps {
  open?: boolean
  /** Откуда выезжает. По умолчанию справа. */
  placement?: 'right' | 'left' | 'bottom'
  /** Ширина боковой шторки; число — пиксели. */
  width?: number | string
  /** Высота нижней шторки; число — пиксели. */
  height?: number | string
  /** Заголовок; можно и слотом `#title`. */
  title?: string
  /** Крестик в шапке. По умолчанию есть. */
  closable?: boolean
  /** Нажатие по маске закрывает. По умолчанию да. */
  maskClosable?: boolean
}

export interface DrawerEmits {
  (e: 'update:open', open: boolean): void
  (e: 'close'): void
}
