// Нажатие мимо открытого меню только закрывает его: до кнопки под маской не
// доходит ни нажатие, ни щелчок. Внутри меню и на его кнопке всё как раньше.
// Меню, которое не закрывается, приложение не глушит.

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const noted = vi.hoisted(() => [] as unknown[])
vi.mock('@/helpers/diagnostics/main-thread-stalls', () => ({
  noteStall: (stall: unknown) => noted.push(stall),
}))

import { installPopupClickShield } from './popup-click-shield'
import {
  pushLayer,
  resetLayersForTests,
  type Layer,
  type LayerKind,
} from '@/components/ui-core/layer-stack'

beforeAll(() => installPopupClickShield())

afterEach(() => {
  resetLayersForTests()
  document.body.innerHTML = ''
  // Нажатие без открытых меню обнуляет счёт погашенных — тесты не зависят друг от друга.
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
})

function mounted(className = ''): HTMLElement {
  const el = document.createElement('button')
  el.className = className
  document.body.append(el)
  return el
}

/** Панель или окно на экране. */
function popup(className: string): HTMLElement {
  const el = document.createElement('div')
  el.className = className
  document.body.append(el)
  return el
}

/** Нажатие целиком, как его шлёт браузер: касание или мышь, потом щелчок. */
function tap(target: Element, pointerType: 'mouse' | 'touch' = 'touch'): { clicked: boolean } {
  const opts = { bubbles: true, cancelable: true }
  target.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType }))
  target.dispatchEvent(new MouseEvent('mousedown', opts))
  target.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType }))
  target.dispatchEvent(new MouseEvent('mouseup', opts))
  const click = new MouseEvent('click', opts)
  let clicked = false
  const onClick = (): void => {
    clicked = true
  }
  target.addEventListener('click', onClick)
  target.dispatchEvent(click)
  target.removeEventListener('click', onClick)
  return { clicked }
}

describe('installPopupClickShield', () => {
  /** Своя открытая панель: слой в стеке, закрывается по просьбе. */
  function ownPopup(
    kind: LayerKind = 'dropdown',
    extra: { hover?: boolean; closes?: boolean } = {}
  ): { layer: Layer; panel: HTMLElement; trigger: HTMLElement; dismissed: string[] } {
    const trigger = mounted()
    const panel = popup('own-panel')
    const dismissed: string[] = []
    const layer: Layer = pushLayer({
      kind,
      el: () => panel,
      anchor: () => trigger,
      hover: extra.hover,
      onDismiss: (reason) => {
        dismissed.push(reason)
        if (extra.closes !== false) layer.close()
      },
    })
    return { layer, panel, trigger, dismissed }
  }

  it('нажатие мимо закрывает панель (outside) и не доходит до того, что под ней', () => {
    const { dismissed } = ownPopup()
    const below = mounted()
    expect(tap(below).clicked).toBe(false)
    expect(dismissed).toEqual(['outside'])
    // Панель закрылась — следующее нажатие проходит.
    expect(tap(below).clicked).toBe(true)
  })

  it('ничего не открыто — маски нет', () => {
    expect(tap(mounted()).clicked).toBe(true)
  })

  it('касание ушло в прокрутку — маска снята: щелчок с клавиатуры проходит', () => {
    ownPopup('dropdown', { closes: false })
    const below = mounted()
    below.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    below.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch' }))
    const clicked = vi.fn()
    below.addEventListener('click', clicked)
    below.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(clicked).toHaveBeenCalledTimes(1)
  })

  it('в панели и по её кнопке нажатия работают', () => {
    const { panel, trigger, dismissed } = ownPopup('popover')
    const item = document.createElement('button')
    panel.append(item)
    expect(tap(item).clicked).toBe(true)
    expect(tap(trigger).clicked).toBe(true)
    expect(dismissed).toEqual([])
  })

  it('окно, открытое из пункта меню (позже панели), — не мимо; окно под панелью — мимо', () => {
    const under = popup('own-modal')
    pushLayer({ kind: 'modal', el: () => under })
    const { dismissed } = ownPopup()
    expect(tap(under).clicked).toBe(false)
    expect(dismissed).toEqual(['outside'])

    const { dismissed: again } = ownPopup('dropdown', { closes: false })
    const confirm = popup('own-confirm')
    pushLayer({ kind: 'modal', el: () => confirm })
    expect(tap(confirm).clicked).toBe(true)
    expect(again).toEqual([])
  })

  it('нажатие во внешней панели закрывает вложенную, но само проходит', () => {
    const outer = ownPopup('dropdown', { closes: false })
    const inner = ownPopup('dropdown')
    // Кнопка вложенного меню — в строке внешней панели.
    outer.panel.append(inner.trigger)
    const row = document.createElement('button')
    outer.panel.append(row)
    expect(tap(inner.trigger).clicked).toBe(true)
    expect(inner.dismissed).toEqual([])
    expect(tap(row).clicked).toBe(true)
    expect(inner.dismissed).toEqual(['outside'])
    expect(outer.dismissed).toEqual([])
  })

  it('панель «по наведению»: мышью рядом жмётся, пальцем — маска', () => {
    ownPopup('popover', { hover: true, closes: false })
    const below = mounted()
    expect(tap(below, 'mouse').clicked).toBe(true)
    expect(tap(below, 'touch').clicked).toBe(false)
  })

  it('панель не закрывается от нажатий мимо — гасятся только два, в сведения — её вид', () => {
    ownPopup('select', { closes: false })
    const below = mounted()
    noted.length = 0
    expect(tap(below).clicked).toBe(false)
    expect(tap(below).clicked).toBe(false)
    expect(tap(below).clicked).toBe(true)
    expect(noted).toEqual([{ ms: 0, kind: 'tap-shield', detail: 'layer:select' }])
  })
})
