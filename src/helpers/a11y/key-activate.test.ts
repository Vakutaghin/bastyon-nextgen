// Клавиатура для своих панелей из стека слоёв (src/components/ui-core): они
// и есть открытые меню. После открытия с клавиатуры
// фокус уходит в новую панель (не в ту, что была открыта до нажатия), а Esc в
// панели просит её закрыться и возвращает фокус на кнопку.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { pushLayer, resetLayersForTests } from '@/components/ui-core/layer-stack'
import { attachPopupKeys, focusIntoPopup, lastOpenPopup } from './key-activate'

afterEach(() => {
  resetLayersForTests()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

function panel(items: string[]): HTMLElement {
  const el = document.createElement('div')
  for (const id of items) {
    const item = document.createElement('div')
    item.id = id
    item.setAttribute('role', 'menuitem')
    item.tabIndex = -1
    el.append(item)
  }
  document.body.append(el)
  return el
}

function button(): HTMLButtonElement {
  const el = document.createElement('button')
  document.body.append(el)
  return el
}

describe('свои панели в key-activate', () => {
  it('lastOpenPopup — своя панель из стека, последняя открытая', () => {
    expect(lastOpenPopup()).toBeNull()
    const own = panel(['a'])
    pushLayer({ kind: 'dropdown', el: () => own })
    expect(lastOpenPopup()).toBe(own)
    pushLayer({ kind: 'modal', el: () => panel(['m']) })
    expect(lastOpenPopup()).toBe(own)
  })

  it('открыли с клавиатуры — фокус на первый пункт новой панели, не прежней', () => {
    vi.useFakeTimers()
    const old = panel(['old'])
    pushLayer({ kind: 'popover', el: () => old })
    const trigger = button()
    focusIntoPopup(trigger)
    const fresh = panel(['first', 'second'])
    pushLayer({ kind: 'dropdown', el: () => fresh })
    vi.advanceTimersByTime(100)
    expect(document.activeElement?.id).toBe('first')
  })

  it('Esc в своей панели просит её закрыться и возвращает фокус на кнопку', () => {
    const trigger = button()
    const el = panel(['a', 'b'])
    const onDismiss = vi.fn()
    pushLayer({ kind: 'dropdown', el: () => el, onDismiss })
    attachPopupKeys(el, trigger)
    ;(el.querySelector('#a') as HTMLElement).focus()
    const clicked = vi.fn()
    trigger.addEventListener('click', clicked)
    el.querySelector('#a')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
    expect(onDismiss).toHaveBeenCalledWith('escape')
    expect(clicked).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
  })
})
