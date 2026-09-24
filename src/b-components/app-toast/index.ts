import { notification } from 'ant-design-vue'

/**
 * Универсальный компонент тостов (уведомлений)
 * Использует Ant Design Vue notification с фиксированной позицией bottom-left
 */

const DEFAULT_DURATION = 4.5
const PLACEMENT = 'bottomLeft'
// Слой тостов (N32) задаётся глобально в `style.css` — `.ant-notification`
// поднят до Z_INDEX.TOAST (3000). У ant по умолчанию 1050, а маски модалок
// начинаются с 2000, поэтому «Скопировано» из модалки с мнемоникой было не
// видно. Контейнер создаёт сама библиотека, задать слой из этого модуля нельзя.

export interface T_ToastOptions {
  message: string
  description?: string
  duration?: number
  key?: string
  /** Клик по тосту (например, переход в настройки). */
  onClick?: () => void
}

type NotificationType = 'success' | 'error' | 'info' | 'warning'

const createMethod = (type: NotificationType) => (options: T_ToastOptions) =>
  notification[type]({
    message: options.message,
    description: options.description,
    duration: options.duration || DEFAULT_DURATION,
    placement: PLACEMENT,
    key: options.key,
    onClick: options.onClick,
  })

export const appToast = {
  success: createMethod('success'),
  error: createMethod('error'),
  info: createMethod('info'),
  warning: createMethod('warning'),
}
