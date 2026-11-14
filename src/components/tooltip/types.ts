import type { UiPlacement } from '@/components/ui-core/floating'

export type TooltipTrigger = 'hover' | 'focus' | 'click'

export interface TooltipProps {
  /** Текст; пустой — подсказки нет. Можно и слотом `#title`. */
  title?: string
  /** Сторона, как у antd; по умолчанию сверху. */
  placement?: UiPlacement
  /** По умолчанию — наведение и фокус с клавиатуры. */
  trigger?: TooltipTrigger | TooltipTrigger[]
  /** Задержка перед показом по наведению, секунды (0,1 — как у antd). */
  mouseEnterDelay?: number
  /** Класс панели — для правил родителя (`--ui-tooltip-max-width`). */
  overlayClass?: string
}
