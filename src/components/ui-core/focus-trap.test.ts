// Ловушка фокуса окна: при открытии фокус в окне (на autofocus или на самом
// окне, не на первом поле — на телефоне поле открыло бы клавиатуру), Tab и
// Shift+Tab ходят по кругу, при закрытии фокус возвращается на кнопку.

import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { tabbables, trapFocus, useFocusTrap } from './focus-trap'

afterEach(() => {
  document.body.innerHTML = ''
})

function dialog(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.append(el)
  return el
}

function opener(): HTMLButtonElement {
  const button = document.createElement('button')
  button.textContent = 'Открыть'
  document.body.append(button)
  button.focus()
  return button
}

function tab(shift = false): KeyboardEvent {
  const target = document.activeElement ?? document.body
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  })
  target.dispatchEvent(event)
  return event
}

describe('trapFocus', () => {
  it('фокус — на само окно, а не на первое поле; по Tab — первый элемент', () => {
    const el = dialog('<input id="a"><button id="b">ok</button>')
    trapFocus(el)
    expect(document.activeElement).toBe(el)
    expect(el.getAttribute('tabindex')).toBe('-1')
    expect(tab().defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('a')
  })

  it('autofocus / data-autofocus и initialFocus выигрывают', () => {
    const el = dialog('<input id="a"><input id="b" data-autofocus>')
    trapFocus(el)
    expect(document.activeElement?.id).toBe('b')
    const other = dialog('<input id="c"><input id="d">')
    trapFocus(other, { initialFocus: () => other.querySelector('#c') })
    expect(document.activeElement?.id).toBe('c')
  })

  it('Tab с последнего — на первый, Shift+Tab с первого — на последний', () => {
    const el = dialog('<button id="a">1</button><a id="b" href="#">2</a><button id="c">3</button>')
    trapFocus(el)
    ;(el.querySelector('#c') as HTMLElement).focus()
    expect(tab().defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('a')
    expect(tab(true).defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('c')
  })

  it('в середине Tab работает сам, браузерный', () => {
    const el = dialog('<button id="a">1</button><button id="b">2</button><button id="c">3</button>')
    trapFocus(el)
    ;(el.querySelector('#b') as HTMLElement).focus()
    expect(tab().defaultPrevented).toBe(false)
  })

  it('disabled, tabindex=-1 и inert в обход не попадают', () => {
    const el = dialog(
      '<button disabled>x</button><span tabindex="-1">y</span>' +
        '<div inert><button>z</button></div><button id="ok">ok</button>'
    )
    expect(tabbables(el).map((n) => n.id)).toEqual(['ok'])
  })

  it('закрыли — фокус вернулся на кнопку; returnFocus: false — не вернулся', () => {
    const button = opener()
    const release = trapFocus(dialog('<input>'))
    release()
    release()
    expect(document.activeElement).toBe(button)
    const second = opener()
    const el = dialog('<input id="x" autofocus>')
    trapFocus(el, { returnFocus: false })()
    expect(document.activeElement).not.toBe(second)
  })
})

describe('useFocusTrap', () => {
  it('ловит, пока active, после отрисовки; снятие области отпускает', async () => {
    const button = opener()
    const el = dialog('<button id="in">in</button>')
    const active = ref(false)
    const scope = effectScope()
    scope.run(() => useFocusTrap(active, () => el))
    active.value = true
    await nextTick()
    expect(document.activeElement).toBe(el)
    active.value = false
    await nextTick()
    expect(document.activeElement).toBe(button)
    active.value = true
    await nextTick()
    scope.stop()
    expect(document.activeElement).toBe(button)
  })
})
