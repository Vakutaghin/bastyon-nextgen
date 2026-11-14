import type { UiPlacement } from '@/components/ui-core/floating'

export interface PopconfirmProps {
  title: string
  description?: string
  okText: string
  cancelText: string
  /** Опасное действие — красная кнопка. */
  danger?: boolean
  placement?: UiPlacement
}

export interface PopconfirmEmits {
  (e: 'confirm'): void
  (e: 'cancel'): void
}
