import { notification } from 'ant-design-vue'

/**
 * Универсальный компонент тостов (уведомлений)
 * Использует Ant Design Vue notification с фиксированной позицией bottom-left
 */

const DEFAULT_DURATION = 4.5
const PLACEMENT = 'bottomLeft'

export interface T_ToastOptions {
  message: string
  description?: string
  duration?: number
  key?: string
}

type NotificationType = 'success' | 'error' | 'info' | 'warning'

const createMethod = (type: NotificationType) =>
  (options: T_ToastOptions) => notification[type]({
    message: options.message,
    description: options.description,
    duration: options.duration || DEFAULT_DURATION,
    placement: PLACEMENT,
    key: options.key,
  })

export const appToast = {
  success: createMethod('success'),
  error: createMethod('error'),
  info: createMethod('info'),
  warning: createMethod('warning'),
}
