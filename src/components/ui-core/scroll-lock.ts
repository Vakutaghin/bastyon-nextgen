/**
 * Блокировка прокрутки страницы под окном. Счётчик: страница снова
 * листается, когда закрылось последнее окно.
 *
 * Класс на `<html>` и правило в style.css, а не стили на `body`: antd пишет
 * на `body` свои и сам их восстанавливает, и два механизма не должны
 * перетирать друг друга, пока работают вместе. Ширина полосы прокрутки
 * вычитается из ширины страницы (`--ui-scroll-lock-gap`), чтобы она не
 * прыгала, — так же делает antd.
 */

import { onScopeDispose, watch, type WatchSource } from 'vue'

export const SCROLL_LOCK_CLASS = 'ui-scroll-locked'
const GAP_VAR = '--ui-scroll-lock-gap'

let locks = 0

function apply(): void {
  const html = document.documentElement
  const gap = Math.max(0, window.innerWidth - html.clientWidth)
  html.style.setProperty(GAP_VAR, `${gap}px`)
  html.classList.add(SCROLL_LOCK_CLASS)
}

function remove(): void {
  const html = document.documentElement
  html.classList.remove(SCROLL_LOCK_CLASS)
  html.style.removeProperty(GAP_VAR)
}

/** Запретить прокрутку; вернёт функцию, которая снимает эту блокировку. */
export function lockScroll(): () => void {
  if (locks++ === 0) apply()
  let released = false
  return () => {
    if (released) return
    released = true
    if (--locks === 0) remove()
  }
}

/** Прокрутка запрещена, пока `active`. */
export function useScrollLock(active: WatchSource<boolean>): void {
  let release: (() => void) | null = null
  const stop = (): void => {
    release?.()
    release = null
  }
  watch(
    active,
    (isActive) => {
      if (isActive && !release) release = lockScroll()
      else if (!isActive) stop()
    },
    { immediate: true }
  )
  onScopeDispose(stop)
}

/** Сброс счётчика — только для тестов. */
export function resetScrollLockForTests(): void {
  locks = 0
  remove()
}
