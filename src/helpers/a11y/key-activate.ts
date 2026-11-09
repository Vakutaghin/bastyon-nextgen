/**
 * `v-key-activate` — клавиатура для того, что нажимается только мышью.
 *
 * - Enter и пробел на элементе (div с role=button у значков шапки и т. п.)
 *   нажимают его, как щелчок. Мышь и касание работают как раньше.
 * - `{ popup: true }` — элемент открывает выпадающее меню antd (Dropdown,
 *   Popover). У antd оно ложится в конец страницы, и Tab до него не доходит, а
 *   клавиш у его меню нет. После открытия с клавиатуры фокус уходит на первый
 *   пункт; стрелки вверх-вниз, Home и End ходят по пунктам, Enter и пробел
 *   нажимают пункт, Esc закрывает меню и возвращает фокус на кнопку.
 *
 * Открытие мышью меню не трогает: фокус переносится, только если меню открыли
 * клавишей.
 */

import type { Directive } from 'vue'

export interface KeyActivateOptions {
  /** Элемент открывает выпадающее меню antd: фокус — в него. */
  popup?: boolean
}

const ITEMS = [
  '[role="menuitem"]:not([aria-disabled="true"])',
  '[role="menuitemradio"]:not([aria-disabled="true"])',
  '[role="option"]:not([aria-disabled="true"])',
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

const OPEN_POPUPS = '.ant-dropdown:not(.ant-dropdown-hidden), .ant-popover:not(.ant-popover-hidden)'

/**
 * Сколько ждать, пока antd покажет меню: при первом открытии оно монтируется
 * не сразу (в браузере — несколько сотен миллисекунд), поэтому опрос по времени.
 */
const POPUP_POLL_MS = 40
const POPUP_WAIT_MS = 1500

/** Открытое меню antd, последнее в документе, — то, что открылось только что. */
export function lastOpenPopup(doc: Document = document): HTMLElement | null {
  const all = doc.querySelectorAll<HTMLElement>(OPEN_POPUPS)
  return all.length > 0 ? all[all.length - 1]! : null
}

function isVisible(el: HTMLElement): boolean {
  // jsdom не считает раскладку — там видно всё.
  if (typeof el.checkVisibility === 'function') return el.checkVisibility()
  return el.getClientRects().length > 0 || !el.isConnected
}

/** Пункты меню, по которым ходят стрелки. */
export function popupItems(popup: HTMLElement): HTMLElement[] {
  return [...popup.querySelectorAll<HTMLElement>(ITEMS)].filter(
    (el) => isVisible(el) && !el.closest('[inert]')
  )
}

const popupKeys = new WeakMap<HTMLElement, (e: KeyboardEvent) => void>()

/**
 * Клавиши внутри меню: стрелки, Home/End, Enter/пробел на пункте, Esc.
 * `close` — как закрыть своё (не antd) меню; без него Esc повторно нажимает
 * кнопку, и меню antd закрывается само.
 */
export function attachPopupKeys(
  popup: HTMLElement,
  trigger: HTMLElement,
  close?: () => void
): void {
  const previous = popupKeys.get(popup)
  if (previous) popup.removeEventListener('keydown', previous)

  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    const target = e.target as HTMLElement
    const inField = target.matches('input, textarea, select, [contenteditable="true"]')
    const items = popupItems(popup)
    const index = items.indexOf(target)

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (close) close()
      else if (popup.matches(OPEN_POPUPS)) trigger.click()
      trigger.focus()
      return
    }
    if (inField) return
    let next: HTMLElement | undefined
    if (e.key === 'ArrowDown') next = items[index < 0 ? 0 : (index + 1) % items.length]
    else if (e.key === 'ArrowUp') {
      next = items[index <= 0 ? items.length - 1 : index - 1]
    } else if (e.key === 'Home') next = items[0]
    else if (e.key === 'End') next = items[items.length - 1]
    else if ((e.key === 'Enter' || e.key === ' ') && index >= 0) {
      // У настоящей кнопки и ссылки Enter работает сам; пункт меню antd — <li>.
      if (target.matches('button, a[href], input, textarea, select')) return
      e.preventDefault()
      target.click()
      return
    }
    if (next) {
      e.preventDefault()
      next.focus()
    }
  }
  popup.addEventListener('keydown', onKey)
  popupKeys.set(popup, onKey)
}

/** После открытия с клавиатуры — фокус на первый пункт меню. */
export function focusIntoPopup(trigger: HTMLElement, waitMs = POPUP_WAIT_MS): void {
  const doc = trigger.ownerDocument
  // Меню, открытое до нажатия, — не наше: ждём новое.
  const before = lastOpenPopup(doc)
  const deadline = Date.now() + waitMs
  const tick = (): void => {
    const popup = lastOpenPopup(doc)
    if (!popup || popup === before || popupItems(popup).length === 0) {
      if (Date.now() < deadline) setTimeout(tick, POPUP_POLL_MS)
      else if (popup && popup !== before) attachAndFocus(popup)
      return
    }
    attachAndFocus(popup)
  }
  const attachAndFocus = (popup: HTMLElement): void => {
    attachPopupKeys(popup, trigger)
    const first = popupItems(popup)[0]
    if (first) {
      first.focus()
    } else {
      if (!popup.hasAttribute('tabindex')) popup.setAttribute('tabindex', '-1')
      popup.focus()
    }
  }
  setTimeout(tick, POPUP_POLL_MS)
}

/**
 * Своё меню (не antd) открыли с клавиатуры: фокус на первый пункт и те же
 * клавиши. Вызывать после того, как меню появилось в DOM (nextTick).
 */
export function focusMenu(menu: HTMLElement, trigger: HTMLElement, close: () => void): void {
  attachPopupKeys(menu, trigger, close)
  const first = popupItems(menu)[0]
  if (first) first.focus()
}

/** Щелчок пришёл с клавиатуры (Enter или пробел на кнопке): у такого detail = 0. */
export function isKeyboardClick(e: MouseEvent): boolean {
  return e.detail === 0
}

type KeyActivateEl = HTMLElement & {
  __keyActivate?: (e: KeyboardEvent) => void
  __keyActivateOptions?: KeyActivateOptions
}

export const vKeyActivate: Directive<KeyActivateEl, KeyActivateOptions | undefined> = {
  mounted(el, binding) {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
      // Esc, пока фокус ещё на кнопке (меню только открылось), закрывает меню.
      if (
        e.key === 'Escape' &&
        el.__keyActivateOptions?.popup &&
        el.getAttribute('aria-expanded') === 'true'
      ) {
        e.preventDefault()
        el.click()
        return
      }
      if (e.key !== 'Enter' && e.key !== ' ') return
      // Только сам элемент: Enter в поле внутри него — не нажатие.
      if (e.target !== el) return
      e.preventDefault()
      el.click()
      if (el.__keyActivateOptions?.popup) focusIntoPopup(el)
    }
    el.__keyActivateOptions = binding.value
    el.__keyActivate = onKey
    el.addEventListener('keydown', onKey)
  },
  updated(el, binding) {
    el.__keyActivateOptions = binding.value
  },
  beforeUnmount(el) {
    if (el.__keyActivate) el.removeEventListener('keydown', el.__keyActivate)
    delete el.__keyActivate
    delete el.__keyActivateOptions
  },
}
