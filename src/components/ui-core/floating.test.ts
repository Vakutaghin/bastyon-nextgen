// Положение панели у кнопки: стороны в именах antd переводятся в floating-ui,
// панель скрыта до первого расчёта, после — на месте и с data-placement
// (сторона после переворота). Сам расчёт — floating-ui, здесь он подменён: в
// happy-dom нет раскладки.

import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fl = vi.hoisted(() => ({
  cleanup: vi.fn(),
  update: null as null | (() => void),
  result: { x: 10.4, y: 20.6, placement: 'top-end' },
  options: null as null | { placement: string; strategy: string },
}))

vi.mock('@floating-ui/dom', () => ({
  autoUpdate: (_ref: HTMLElement, _floating: HTMLElement, update: () => void) => {
    fl.update = update
    update()
    return fl.cleanup
  },
  computePosition: vi.fn(async (_r: HTMLElement, floating: HTMLElement, options) => {
    fl.options = options
    for (const m of options.middleware as Array<{ name: string; fn?: unknown }>) {
      if (m.name === 'size') {
        ;(m as unknown as { options: { apply: (a: unknown) => void } }).options.apply({
          availableHeight: 300.7,
          availableWidth: 500.2,
          rects: { reference: { width: 120.4 } },
          elements: { floating },
        })
      }
    }
    return fl.result
  }),
  offset: (v: number) => ({ name: 'offset', options: v }),
  flip: (o: unknown) => ({ name: 'flip', options: o }),
  shift: (o: unknown) => ({ name: 'shift', options: o }),
  size: (o: unknown) => ({ name: 'size', options: o }),
}))

import { anchorFloating, toFloatingPlacement, useFloating } from './floating'

afterEach(() => {
  document.body.innerHTML = ''
  fl.cleanup.mockClear()
})

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

function pair(): { reference: HTMLElement; floating: HTMLElement } {
  const reference = document.createElement('button')
  const floating = document.createElement('div')
  document.body.append(reference, floating)
  return { reference, floating }
}

describe('toFloatingPlacement', () => {
  it('стороны antd → floating-ui', () => {
    expect(toFloatingPlacement('bottomRight')).toBe('bottom-end')
    expect(toFloatingPlacement('topLeft')).toBe('top-start')
    expect(toFloatingPlacement('leftBottom')).toBe('left-end')
    expect(toFloatingPlacement('right')).toBe('right')
  })
})

describe('anchorFloating', () => {
  it('скрыта до расчёта, потом на месте, с data-placement и местом до края', async () => {
    const { reference, floating } = pair()
    const stop = anchorFloating(reference, floating, { placement: 'bottomRight', matchWidth: true })
    expect(floating.style.position).toBe('fixed')
    expect(floating.style.visibility).toBe('hidden')
    expect(floating.hasAttribute('data-ui-floating')).toBe(true)
    await flush()
    expect(fl.options).toMatchObject({ placement: 'bottom-end', strategy: 'fixed' })
    expect(floating.style.left).toBe('10px')
    expect(floating.style.top).toBe('21px')
    expect(floating.style.visibility).toBe('')
    expect(floating.dataset.placement).toBe('top-end')
    expect(floating.style.getPropertyValue('--ui-floating-available-height')).toBe('300px')
    expect(floating.style.minWidth).toBe('120px')
    stop()
    expect(fl.cleanup).toHaveBeenCalledOnce()
  })

  it('расчёт, пришедший после остановки, панель не трогает', async () => {
    const { reference, floating } = pair()
    const stop = anchorFloating(reference, floating)
    stop()
    await flush()
    expect(floating.style.visibility).toBe('hidden')
    expect(floating.dataset.placement).toBeUndefined()
  })
})

describe('useFloating', () => {
  it('держит, пока open и оба элемента есть; закрыли — перестаёт', async () => {
    const { reference, floating } = pair()
    const open = ref(false)
    const scope = effectScope()
    scope.run(() =>
      useFloating(
        open,
        () => reference,
        () => floating,
        { placement: 'top' }
      )
    )
    await nextTick()
    expect(floating.style.position).toBe('')
    open.value = true
    await nextTick()
    await flush()
    expect(fl.options).toMatchObject({ placement: 'top' })
    expect(floating.dataset.placement).toBe('top-end')
    open.value = false
    await nextTick()
    expect(fl.cleanup).toHaveBeenCalledOnce()
    scope.stop()
  })
})
