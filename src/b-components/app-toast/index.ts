import { notification } from 'ant-design-vue'
import { announce } from '@/helpers/a11y/announce'
import { isPhoneLandscape, shellFor } from '@/composables/use-viewport'

/**
 * Универсальный компонент тостов (уведомлений)
 * Использует Ant Design Vue notification: на компьютере — внизу слева, на
 * телефоне — сверху, под шапкой (см. toastPlacement).
 */

const DEFAULT_DURATION = 4.5

/**
 * Где показывать тост. Внизу на телефоне он 4,5 с закрывал поле ввода чата
 * и кнопки снизу, поэтому в каркасе телефона (узкое окно и телефон боком) —
 * сверху, сразу под шапкой: кнопки шапки («Назад», меню) остаются доступны.
 * Решается на каждый тост — окно могли повернуть или сузить.
 */
export function toastPlacement(): { placement: 'top' | 'bottomLeft'; top?: string } {
  if (typeof window === 'undefined') return { placement: 'bottomLeft' }
  const shell = shellFor(window.innerWidth, isPhoneLandscape())
  if (shell === 'desktop') return { placement: 'bottomLeft' }
  // --header-height-total — шапка вместе с вырезом экрана сверху (style.css).
  return { placement: 'top', top: 'calc(var(--header-height-total) + 8px)' }
}
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

const createMethod = (type: NotificationType) => (options: T_ToastOptions) => {
  // Тост antd диктор сам не читает (у него нет aria-live) — произносим его текст.
  // Ошибка перебивает диктора, остальное ждёт паузы.
  announce(
    [options.message, options.description].filter(Boolean).join('. '),
    type === 'error' ? 'assertive' : 'polite'
  )
  return notification[type]({
    message: options.message,
    description: options.description,
    duration: options.duration || DEFAULT_DURATION,
    ...toastPlacement(),
    key: options.key,
    onClick: options.onClick,
  })
}

export const appToast = {
  success: createMethod('success'),
  error: createMethod('error'),
  info: createMethod('info'),
  warning: createMethod('warning'),
  /** Убрать тост с этим `key` — например, по клику на него. */
  close: (key: string) => notification.close(key),
}
