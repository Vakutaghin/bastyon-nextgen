// Стек слоёв: слой (z-index) считается, а не пишется руками — открытое из окна
// всегда выше окна; Esc и «Назад» закрывают только верхний слой и дальше не
// идут; окна antd на переходный период тоже учитываются.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Z_INDEX } from '@/styles/design-tokens'
import { handleBack, resetBackHandlersForTests } from '@/composables/use-back-button'
import {
  contextZ,
  dismissPopupLayers,
  layerContaining,
  openLayers,
  popupLayers,
  pushLayer,
  resetLayersForTests,
  topLayer,
  type LayerOptions,
} from './layer-stack'

afterEach(() => {
  resetLayersForTests()
  resetBackHandlersForTests()
  document.body.innerHTML = ''
})

function box(parent: HTMLElement = document.body): HTMLElement {
  const el = document.createElement('div')
  parent.append(el)
  return el
}

function open(options: Partial<LayerOptions> & Pick<LayerOptions, 'kind'>) {
  const el = box()
  const onDismiss = vi.fn()
  const layer = pushLayer({ el: () => el, onDismiss, ...options })
  return { layer, el, onDismiss }
}

function pressEscape(init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
    ...init,
  })
  const reachedWindow = vi.fn()
  window.addEventListener('keydown', reachedWindow)
  target.dispatchEvent(event)
  window.removeEventListener('keydown', reachedWindow)
  return { event, reachedWindow: reachedWindow.mock.calls.length > 0 }
}

describe('слой (z-index)', () => {
  it('база — из токенов вида; тост и подсказка на своих уровнях', () => {
    expect(open({ kind: 'modal' }).layer.zIndex).toBe(Z_INDEX.MODAL)
    resetLayersForTests()
    expect(open({ kind: 'dropdown' }).layer.zIndex).toBe(Z_INDEX.DROPDOWN)
    expect(open({ kind: 'toast' }).layer.zIndex).toBe(Z_INDEX.TOAST)
    expect(open({ kind: 'tooltip' }).layer.zIndex).toBe(Z_INDEX.TOOLTIP)
  })

  it('открытое из окна — выше окна, следующее — ещё выше', () => {
    const modal = open({ kind: 'modal' }).layer
    const menu = open({ kind: 'dropdown' }).layer
    const confirm = open({ kind: 'modal' }).layer
    expect(menu.zIndex).toBe(modal.zIndex + 1)
    expect(confirm.zIndex).toBe(menu.zIndex + 1)
  })

  it('тосты и подсказки не поднимают следующие слои', () => {
    open({ kind: 'toast' })
    open({ kind: 'tooltip' })
    expect(open({ kind: 'modal' }).layer.zIndex).toBe(Z_INDEX.MODAL)
  })

  it('панель от кнопки внутри слоя со своим z-index — выше него (мессенджер на 2500)', () => {
    const surface = box()
    surface.style.position = 'fixed'
    surface.style.zIndex = '2500'
    const button = document.createElement('button')
    box(surface).append(button)
    expect(contextZ(button)).toBe(2500)
    expect(open({ kind: 'popover', anchor: () => button }).layer.zIndex).toBe(2501)
  })

  it('без кнопки берёт элемент в фокусе в момент открытия', () => {
    const surface = box()
    surface.style.position = 'relative'
    surface.style.zIndex = '2600'
    const input = document.createElement('input')
    surface.append(input)
    input.focus()
    expect(open({ kind: 'modal' }).layer.zIndex).toBe(2601)
  })

  it('тост элемент в фокусе своей кнопкой не считает', () => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    const toast = open({ kind: 'toast' }).layer
    expect(toast.anchor()).toBeNull()
    expect(layerContaining(button)).toBeUndefined()
  })

  it('surface — со своим уровнем; следующее окно встаёт над ней', () => {
    expect(open({ kind: 'surface', zIndex: 2500 }).layer.zIndex).toBe(2500)
    expect(open({ kind: 'modal' }).layer.zIndex).toBe(2501)
  })

  it('закрытый слой больше не поднимает новые', () => {
    const modal = open({ kind: 'modal' }).layer
    modal.close()
    modal.close()
    expect(openLayers()).toHaveLength(0)
    expect(open({ kind: 'modal' }).layer.zIndex).toBe(Z_INDEX.MODAL)
  })
})

describe('Esc', () => {
  it('закрывает только верхний слой и дальше не идёт', () => {
    const below = open({ kind: 'modal' })
    const top = open({ kind: 'dropdown' })
    const { event, reachedWindow } = pressEscape()
    expect(top.onDismiss).toHaveBeenCalledWith('escape')
    expect(below.onDismiss).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
    expect(reachedWindow).toBe(false)
  })

  it('тосты пропускает: Esc — тому, с чем работают', () => {
    const modal = open({ kind: 'modal' })
    const toast = open({ kind: 'toast' })
    pressEscape()
    expect(toast.onDismiss).not.toHaveBeenCalled()
    expect(modal.onDismiss).toHaveBeenCalledWith('escape')
  })

  it('окно без Esc (closeOnEscape: false) не закрывается, но и нижние не трогает', () => {
    const below = open({ kind: 'modal' })
    const locked = open({ kind: 'modal', closeOnEscape: false })
    const { reachedWindow } = pressEscape()
    expect(locked.onDismiss).not.toHaveBeenCalled()
    expect(below.onDismiss).not.toHaveBeenCalled()
    expect(reachedWindow).toBe(false)
  })

  it('панель без Esc пропускает его странице', () => {
    open({ kind: 'popover', closeOnEscape: false })
    expect(pressEscape().reachedWindow).toBe(true)
  })

  it('погашенный раньше Esc (окно antd) и набор иероглифов не трогает', () => {
    const top = open({ kind: 'modal' })
    const inner = box()
    inner.addEventListener('keydown', (e) => e.preventDefault())
    pressEscape({}, inner)
    pressEscape({ isComposing: true })
    expect(top.onDismiss).not.toHaveBeenCalled()
  })

  it('без открытых слоёв Esc идёт странице', () => {
    open({ kind: 'modal' }).layer.close()
    expect(pressEscape().reachedWindow).toBe(true)
  })
})

describe('«Назад» на Android', () => {
  it('закрывает верхний слой; без onDismiss и с closeOnBack: false — не берёт', () => {
    const modal = open({ kind: 'modal' })
    open({ kind: 'drawer', closeOnBack: false })
    pushLayer({ kind: 'popover', el: () => null })
    expect(handleBack()).toBe(true)
    expect(modal.onDismiss).toHaveBeenCalledWith('back')
  })

  it('подсказки и тосты «Назад» не берут', () => {
    open({ kind: 'tooltip' })
    open({ kind: 'toast' })
    expect(handleBack()).toBe(false)
  })

  it('закрытый слой убирает свой обработчик', () => {
    open({ kind: 'modal' }).layer.close()
    expect(handleBack()).toBe(false)
  })
})

describe('поиск слоёв', () => {
  it('нажатие в панели или по её кнопке — внутри слоя', () => {
    const button = box()
    const { layer, el } = open({ kind: 'dropdown', anchor: () => button })
    const item = box(el)
    expect(layerContaining(item)).toBe(layer)
    expect(layerContaining(button)).toBe(layer)
    expect(layerContaining(box())).toBeUndefined()
    expect(layer.contains(null)).toBe(false)
  })

  it('всплывающие панели — popover, dropdown, select; закрываются все разом', () => {
    open({ kind: 'modal' })
    const a = open({ kind: 'popover' })
    const b = open({ kind: 'select' })
    expect(popupLayers().map((l) => l.kind)).toEqual(['popover', 'select'])
    expect(topLayer((l) => l.kind === 'modal')?.kind).toBe('modal')
    dismissPopupLayers()
    expect(a.onDismiss).toHaveBeenCalledWith('outside')
    expect(b.onDismiss).toHaveBeenCalledWith('outside')
  })

  it('закрытому слою просьбы не доходят', () => {
    const { layer, onDismiss } = open({ kind: 'popover' })
    layer.close()
    layer.dismiss('outside')
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
