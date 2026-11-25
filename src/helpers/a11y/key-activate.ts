/**
 * `v-key-activate` — клавиатура для того, что нажимается только мышью.
 *
 * - Enter и пробел на элементе (div с role=button у значков шапки и т. п.)
 *   нажимают его, как щелчок. Мышь и касание работают как раньше.
 * - `{ popup: true }` — элемент открывает выпадающую панель (Dropdown,
 *   Popover). Панель лежит в конце страницы, и Tab до неё не доходит. После
 *   открытия с клавиатуры фокус уходит на первый пункт; стрелки вверх-вниз,
 *   Home и End ходят по пунктам, Enter и пробел нажимают пункт, Esc закрывает
 *   панель и возвращает фокус на кнопку.
 *
 * Открытие мышью меню не трогает: фокус переносится, только если меню открыли
 * клавишей.
 *
 * Открытые панели берутся из стека слоёв (src/components/ui-core); Esc в
 * панели просит её закрыться (`dismiss`).
 */

import type { Directive } from 'vue'
import { popupLayers } from '@/components/ui-core/layer-stack'

export interface KeyActivateOptions {
  /** Элемент открывает выпадающую панель: фокус — в неё. */
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

/**
 * Сколько ждать, пока панель появится: она монтируется после нажатия, а
 * floating-ui показывает её после расчёта положения, поэтому опрос по времени.
 */
const POPUP_POLL_MS = 40
const POPUP_WAIT_MS = 1500

/** Открытые панели по стеку слоёв, снизу вверх. */
function openPopups(doc: Document): HTMLElement[] {
  return popupLayers()
    .map((layer) => layer.el())
    .filter((el): el is HTMLElement => !!el && el.ownerDocument === doc)
}

/** Открытое меню, последнее, — то, что открылось только что. */
export function lastOpenPopup(doc: Document = document): HTMLElement | null {
  const all = openPopups(doc)
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
 * `close` — как закрыть меню, которого нет в стеке слоёв; без него Esc просит
 * закрыться слой панели.
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
      const layer = popupLayers().find((l) => l.el() === popup)
      if (close) close()
      else if (layer) layer.dismiss('escape')
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
      // У настоящей кнопки и ссылки Enter работает сам; пункт меню — <li>.
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
  // Меню, открытые до нажатия, — не наши: ждём новое.
  const before = new Set(openPopups(doc))
  const deadline = Date.now() + waitMs
  const tick = (): void => {
    const fresh = openPopups(doc).filter((el) => !before.has(el))
    const popup = fresh[fresh.length - 1]
    if (!popup || popupItems(popup).length === 0) {
      if (Date.now() < deadline) setTimeout(tick, POPUP_POLL_MS)
      else if (popup) attachAndFocus(popup)
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
