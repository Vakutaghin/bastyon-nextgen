/**
 * Ловушка фокуса окна: Tab и Shift+Tab ходят по кругу внутри, при открытии
 * фокус уходит в окно, при закрытии возвращается туда, откуда открыли.
 *
 * Свой, а не атрибут `inert` и не `<dialog>`: их нет в Chromium 89 и Safari
 * 15.0, на которых приложение ещё работает.
 *
 * Начальный фокус — на элемент с `autofocus` / `data-autofocus`, иначе на само
 * окно, как у antd. Не на первое поле: на телефоне фокус в поле открывает
 * клавиатуру, и она выезжала бы на каждом окне.
 */

import { onScopeDispose, watch, type WatchSource } from 'vue'

const TABBABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ')

function isVisible(el: HTMLElement): boolean {
  // checkVisibility — Chromium 105+, Safari 17.4+; раньше — по прямоугольникам.
  if (typeof el.checkVisibility === 'function') return el.checkVisibility()
  return el.getClientRects().length > 0
}

/** Элементы, до которых доходит Tab, в порядке документа. */
export function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert]') && isVisible(el)
  )
}

export interface FocusTrapOptions {
  /** Куда поставить фокус при открытии вместо правила по умолчанию. */
  initialFocus?: () => HTMLElement | null
  /** Вернуть фокус при закрытии. По умолчанию — да. */
  returnFocus?: boolean
}

function focusInitial(el: HTMLElement, options: FocusTrapOptions): void {
  const target =
    options.initialFocus?.() ?? el.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ?? el
  if (target === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

/** Поймать фокус в `el`; вернёт функцию, которая отпускает. */
export function trapFocus(el: HTMLElement, options: FocusTrapOptions = {}): () => void {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    const items = tabbables(el)
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) {
      e.preventDefault()
      return
    }
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === el)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || active === el)) {
      e.preventDefault()
      first.focus()
    }
  }

  el.addEventListener('keydown', onKey)
  focusInitial(el, options)

  let released = false
  return () => {
    if (released) return
    released = true
    el.removeEventListener('keydown', onKey)
    if (options.returnFocus !== false && previous?.isConnected) {
      previous.focus({ preventScroll: true })
    }
  }
}

/**
 * Ловушка, пока `active`. Ставится после отрисовки, когда элемент уже в DOM.
 */
export function useFocusTrap(
  active: WatchSource<boolean>,
  el: () => HTMLElement | null,
  options: FocusTrapOptions = {}
): void {
  let release: (() => void) | null = null
  const stop = (): void => {
    release?.()
    release = null
  }
  watch(
    [active, el],
    ([isActive, target]) => {
      if (isActive && target && !release) release = trapFocus(target, options)
      else if (!isActive) stop()
    },
    { immediate: true, flush: 'post' }
  )
  onScopeDispose(stop)
}
