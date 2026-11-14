import type { VNode } from 'vue'

/** Пункт меню. Подменю нет — до первой потребности. */
export interface MenuActionItem {
  key: string
  /** Текст или узел (флаг языка с галочкой). */
  label: string | VNode
  /** Значок: узел или функция, которая его рисует. */
  icon?: VNode | (() => VNode)
  /** Опасное действие — красным. */
  danger?: boolean
  disabled?: boolean
  type?: undefined
}

/** Черта между группами пунктов. */
export interface MenuDivider {
  type: 'divider'
  key?: string
}

export type MenuItem = MenuActionItem | MenuDivider

export interface MenuProps {
  items: readonly MenuItem[]
}

export interface MenuClickInfo {
  key: string
  domEvent: MouseEvent | KeyboardEvent
}

export interface MenuEmits {
  (e: 'click', info: MenuClickInfo): void
}
