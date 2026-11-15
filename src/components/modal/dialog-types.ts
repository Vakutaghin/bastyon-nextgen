import type { VNode, VNodeChild } from 'vue'

export type DialogKind = 'confirm' | 'info' | 'success' | 'error' | 'warning'

/** Текст, узел или функция, которая его рисует (в ней работают i18n и сторы). */
export type DialogContent = string | VNode | (() => VNodeChild)

export interface DialogOptions {
  title?: DialogContent
  content?: DialogContent
  okText?: string
  cancelText?: string
  /** Опасное действие — красная кнопка ОК. */
  danger?: boolean
  /** Имя antd: `okType: 'danger'` — то же, что `danger`. */
  okType?: 'primary' | 'danger'
  okButtonProps?: { danger?: boolean; disabled?: boolean }
  /** Свой значок вместо значка вида; `null` — без значка. */
  icon?: VNode | (() => VNode) | null
  /**
   * ОК. Вернул Promise — кнопка крутится до его конца; отказ оставляет окно
   * открытым (как у antd).
   */
  onOk?: () => unknown
  onCancel?: () => unknown
  /** После анимации закрытия. */
  afterClose?: () => void
  width?: string | number
  /** По центру экрана; иначе 100px от верха, как у antd. */
  centered?: boolean
  /** Слой ставит стек — опция только ради старых вызовов, не действует. */
  zIndex?: number
  maskClosable?: boolean
  keyboard?: boolean
  /** Класс панели окна (для тестов и правил родителя). */
  class?: string
}

export interface DialogHandle {
  /** Поменять опции открытого окна (заголовок, текст по ходу работы). */
  update(options: Partial<DialogOptions>): void
  /** Закрыть окно. */
  destroy(): void
}
