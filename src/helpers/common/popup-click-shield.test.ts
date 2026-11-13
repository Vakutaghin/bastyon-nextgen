// Нажатие мимо открытого меню только закрывает его: до кнопки под маской не
// доходит ни нажатие, ни щелчок. Внутри меню и на его кнопке всё как раньше.
// Залипший класс `-open` без меню на экране и меню, которое не закрывается,
// приложение не глушат.

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

/** Меню на экране. В happy-dom раскладки нет — видимость задаём, как её видит браузер. */
function popup(className: string, visible = true): HTMLElement {
  const el = document.createElement('div')
  el.className = className
  el.getClientRects = () =>
    ({ length: visible ? 1 : 0 }) as unknown as ReturnType<Element['getClientRects']>
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
  it('меню открыто: нажатие мимо закрывает его и не доходит до кнопки под ним', () => {
    mounted('ant-dropdown-trigger ant-dropdown-open')
    popup('ant-dropdown')
    const below = mounted()
    const pressed = vi.fn()
    below.addEventListener('pointerdown', pressed)
    const closer = vi.fn()
    document.addEventListener('mousedown', closer)

    expect(tap(below).clicked).toBe(false)
    expect(pressed).not.toHaveBeenCalled()
    // Меню закрывает свой mousedown на document — им antd и закрывает меню.
    expect(closer).toHaveBeenCalledTimes(1)
    expect(closer.mock.calls[0]![0].target).toBe(document)
    document.removeEventListener('mousedown', closer)
  })

  it('внутри меню и на его кнопке нажатия работают', () => {
    const trigger = mounted('ant-dropdown-trigger ant-dropdown-open')
    const overlay = popup('ant-dropdown')
    const item = document.createElement('li')
    overlay.append(item)

    expect(tap(item).clicked).toBe(true)
    expect(tap(trigger).clicked).toBe(true)
  })

  it('ничего не открыто — маски нет', () => {
    mounted('ant-dropdown-trigger')
    expect(tap(mounted()).clicked).toBe(true)
  })

  it('открытая панель и список поля тоже маскируют', () => {
    const popover = mounted('ant-popover-open')
    const panel = popup('ant-popover')
    expect(tap(mounted()).clicked).toBe(false)
    popover.remove()
    panel.remove()
    mounted('ant-select ant-select-open')
    popup('ant-select-dropdown')
    expect(tap(mounted()).clicked).toBe(false)
  })

  it('панель «по наведению»: мышью рядом жмётся, пальцем — маска', () => {
    mounted('ant-popover-open').setAttribute('data-popup-hover', '')
    popup('ant-popover')
    const below = mounted()
    expect(tap(below, 'mouse').clicked).toBe(true)
    expect(tap(below, 'touch').clicked).toBe(false)
  })

  it('касание ушло в прокрутку — следующее нажатие без меню проходит', () => {
    const trigger = mounted('ant-dropdown-open')
    popup('ant-dropdown')
    const below = mounted()
    below.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    below.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch' }))
    trigger.classList.remove('ant-dropdown-open')
    expect(tap(below).clicked).toBe(true)
  })

  it('класс «открыто» залип, а меню на экране нет — нажатия проходят', () => {
    // Список поля без пунктов: antd держит класс `-open`, но список не рисует
    // и закрывать его не станет. Раньше маска гасила все нажатия навсегда.
    mounted('ant-select ant-select-open')
    popup('ant-select-dropdown', false)
    const below = mounted()
    expect(tap(below).clicked).toBe(true)
    expect(tap(below).clicked).toBe(true)
  })

  it('меню не закрывается от нажатий мимо — гасятся только два, дальше проходят', () => {
    mounted('ant-dropdown-open')
    popup('ant-dropdown')
    const below = mounted()
    noted.length = 0
    expect(tap(below).clicked).toBe(false)
    expect(tap(below).clicked).toBe(false)
    expect(tap(below).clicked).toBe(true)
    expect(tap(below).clicked).toBe(true)
    // Случай — в сведения для поддержки, один раз: чья кнопка залипла.
    expect(noted).toEqual([{ ms: 0, kind: 'tap-shield', detail: 'ant-dropdown-open' }])
  })
})

describe('installPopupClickShield: свои панели из стека слоёв', () => {
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

  it('открыт только список antd в своём окне — нажатие в окне мимо списка маскируется', () => {
    const own = popup('own-modal')
    pushLayer({ kind: 'modal', el: () => own })
    mounted('ant-select ant-select-open')
    popup('ant-select-dropdown')
    const field = document.createElement('button')
    own.append(field)
    expect(tap(field).clicked).toBe(false)
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
