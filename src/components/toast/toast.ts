import { closeToast, holdToast, releaseToast } from './toast-store'
import type { ToastItem } from './types'

/** Обработчики одного тоста: таймер стоит, пока на тосте курсор или фокус. */
export function useToast(item: () => ToastItem) {
  const key = (): string => item().key

  function onMouseenter(): void {
    holdToast(key(), 'hover')
  }

  function onMouseleave(): void {
    releaseToast(key(), 'hover')
  }

  function onFocusin(): void {
    holdToast(key(), 'focus')
  }

  function onFocusout(e: FocusEvent): void {
    const root = e.currentTarget as HTMLElement | null
    if (root?.contains(e.relatedTarget as Node | null)) return
    releaseToast(key(), 'focus')
  }

  function onClick(): void {
    item().onClick?.()
  }

  function close(): void {
    closeToast(key())
  }

  return { onMouseenter, onMouseleave, onFocusin, onFocusout, onClick, close }
}
