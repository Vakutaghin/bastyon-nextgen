import { notification } from 'ant-design-vue'

/**
 * Универсальный компонент тостов (уведомлений)
 * Использует Ant Design Vue notification, но с фиксированной позицией bottom-left
 */

const DEFAULT_DURATION = 4.5
const PLACEMENT = 'bottomLeft'

interface T_ToastOptions {
  message: string
  description?: string
  duration?: number
  key?: string
}

export const appToast = {
  success(options: T_ToastOptions) {
    notification.success({
      message: options.message,
      description: options.description,
      duration: options.duration || DEFAULT_DURATION,
      placement: PLACEMENT,
      key: options.key
    })
  },

  error(options: T_ToastOptions) {
    notification.error({
      message: options.message,
      description: options.description,
      duration: options.duration || DEFAULT_DURATION,
      placement: PLACEMENT,
      key: options.key
    })
  },

  info(options: T_ToastOptions) {
    notification.info({
      message: options.message,
      description: options.description,
      duration: options.duration || DEFAULT_DURATION,
      placement: PLACEMENT,
      key: options.key
    })
  },

  warning(options: T_ToastOptions) {
    notification.warning({
      message: options.message,
      description: options.description,
      duration: options.duration || DEFAULT_DURATION,
      placement: PLACEMENT,
      key: options.key
    })
  }
}
