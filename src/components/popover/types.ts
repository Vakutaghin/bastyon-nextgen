import type { UiPlacement } from '@/components/ui-core/floating'

export type PopupTrigger = 'click' | 'hover'

/** Общее у Popover и Dropdown: кнопка открывает панель. */
export interface PopupProps {
  /** Открыта ли (`v-model:open`); без него панель помнит состояние сама. */
  open?: boolean
  /** По умолчанию — нажатие. С наведением панель открывается и курсором. */
  trigger?: PopupTrigger | PopupTrigger[]
  placement?: UiPlacement
  /** Задержка перед показом по наведению, секунды (0,1 — как у antd). */
  mouseEnterDelay?: number
  /** Класс панели — для правил родителя и тестов. */
  overlayClass?: string
}

export interface PopoverProps extends PopupProps {
  /** Заголовок панели; можно и слотом `#title`. */
  title?: string
  /** Роль панели: окно рядом с кнопкой; у подтверждения — alertdialog. */
  role?: 'dialog' | 'alertdialog'
  /** Название панели для диктора, когда заголовка нет. */
  panelLabel?: string
}

export interface PopupEmits {
  (e: 'update:open', open: boolean): void
  (e: 'openChange', open: boolean): void
}
