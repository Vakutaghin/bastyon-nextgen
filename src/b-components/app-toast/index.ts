import { announce } from '@/helpers/a11y/announce'
import { isPhoneLandscape, shellFor } from '@/composables/use-viewport'
import { closeToast, DEFAULT_DURATION, showToast } from '@/components/toast/toast-store'
import type { ToastPlacement } from '@/components/toast/types'

/**
 * Тосты приложения. Рисует их ToastHost (components/toast) в корне
 * приложения: на компьютере — внизу слева, на телефоне — сверху, под шапкой
 * (см. toastPlacement). Слой — над окнами и их масками (N32): «Скопировано» из
 * окна с мнемоникой видно.
 */

/**
 * Где показывать тост. Внизу на телефоне он 4,5 с закрывал поле ввода чата
 * и кнопки снизу, поэтому в каркасе телефона (узкое окно и телефон боком) —
 * сверху, сразу под шапкой (отступ — в стилях списка тостов): кнопки шапки
 * («Назад», меню) остаются доступны. Решается на каждый тост — окно могли
 * повернуть или сузить.
 */
export function toastPlacement(): ToastPlacement {
  if (typeof window === 'undefined') return 'bottomLeft'
  const shell = shellFor(window.innerWidth, isPhoneLandscape())
  return shell === 'desktop' ? 'bottomLeft' : 'top'
}

export interface T_ToastOptions {
  message: string
  description?: string
  /** Секунды до закрытия, по умолчанию 4,5; 0 — пока не закроют. */
  duration?: number
  /** Тост с тем же ключом обновляется на месте. */
  key?: string
  /** Клик по тосту (например, переход в настройки). */
  onClick?: () => void
}

type NotificationType = 'success' | 'error' | 'info' | 'warning'

const createMethod =
  (type: NotificationType) =>
  (options: T_ToastOptions): void => {
    // Тост диктор сам не читает (у хоста нет aria-live) — произносим его текст.
    // Ошибка перебивает диктора, остальное ждёт паузы.
    announce(
      [options.message, options.description].filter(Boolean).join('. '),
      type === 'error' ? 'assertive' : 'polite'
    )
    showToast({
      type,
      message: options.message,
      description: options.description,
      duration: options.duration ?? DEFAULT_DURATION,
      key: options.key,
      onClick: options.onClick,
      placement: toastPlacement(),
      closable: true,
    })
  }

export const appToast = {
  success: createMethod('success'),
  error: createMethod('error'),
  info: createMethod('info'),
  warning: createMethod('warning'),
  /**
   * Тост «идёт работа» со значком загрузки: висит, пока его не закроют, и
   * без крестика. Возвращает функцию, которая его закрывает.
   */
  loading(message: string): () => void {
    announce(message, 'polite')
    const key = showToast({
      type: 'loading',
      message,
      duration: 0,
      placement: toastPlacement(),
      closable: false,
    })
    return () => closeToast(key)
  },
  /** Убрать тост с этим `key` — например, по клику на него. */
  close: (key: string) => closeToast(key),
}
