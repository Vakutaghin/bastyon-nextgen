// Положение панели у кнопки: стороны в именах antd переводятся в floating-ui,
// панель скрыта до первого расчёта, после — на месте и с data-placement
// (сторона после переворота). Сам расчёт — floating-ui, здесь он подменён: в
// happy-dom нет раскладки.

import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fl = vi.hoisted(() => ({
  cleanup: vi.fn(),
  height: 200,
  update: null as null | (() => void),
  result: { x: 10.4, y: 20.6, placement: 'top-end' },
  options: null as null | { placement: string; strategy: string },
  passes: [] as { crossAxis: boolean; axis: string }[],
  paddings: [] as unknown[],
  offset: null as unknown,
  room: 300.7,
}))

vi.mock('@floating-ui/dom', () => ({
  autoUpdate: (_ref: HTMLElement, _floating: HTMLElement, update: () => void) => {
    fl.update = update
    update()
    return fl.cleanup
  },
  computePosition: vi.fn(async (_r: HTMLElement, floating: HTMLElement, options) => {
    fl.options = options
    const named = (name: string) =>
      (options.middleware as { name: string; options: Record<string, unknown> }[]).find(
        (m) => m.name === name
      )!.options
    fl.paddings = ['flip', 'shift', 'size'].map((name) => named(name).padding)
    fl.offset = named('offset')
    fl.passes.push({
      crossAxis: named('shift').crossAxis as boolean,
      axis: named('flip').fallbackAxisSideDirection as string,
    })
    for (const m of options.middleware as Array<{ name: string; fn?: unknown }>) {
      if (m.name === 'size') {
        ;(m as unknown as { options: { apply: (a: unknown) => void } }).options.apply({
          availableHeight: fl.room,
          availableWidth: 500.2,
          rects: { reference: { width: 120.4 }, floating: { height: fl.height } },
          elements: { floating },
        })
      }
    }
    return fl.result
  }),
  offset: (v: unknown) => ({ name: 'offset', options: v }),
  flip: (o: unknown) => ({ name: 'flip', options: o }),
  shift: (o: unknown) => ({ name: 'shift', options: o }),
  size: (o: unknown) => ({ name: 'size', options: o }),
}))

vi.mock('./screen-insets', () => ({
  safeInsets: () => ({ top: 40, right: 0, bottom: 34, left: 0 }),
  coveredInsets: () => ({ top: 64, right: 0, bottom: 50, left: 0 }),
}))

import { anchorFloating, toFloatingPlacement, useFloating } from './floating'

afterEach(() => {
  document.body.innerHTML = ''
  fl.cleanup.mockClear()
  fl.passes.length = 0
  fl.room = 300.7
  fl.height = 200
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

  it('помещается у кнопки — одного расчёта хватает; вбок — только меню, не список поля', async () => {
    const { reference, floating } = pair()
    anchorFloating(reference, floating)
    await flush()
    expect(fl.passes).toEqual([{ crossAxis: false, axis: 'start' }])
    anchorFloating(reference, floating, { matchWidth: 'exact' })
    await flush()
    expect(fl.passes[1]).toEqual({ crossAxis: false, axis: 'none' })
  })

  it('у кнопки тесно, а на экран помещается — ложится поверх кнопки', async () => {
    const { reference, floating } = pair()
    fl.room = 260
    fl.height = 340
    vi.stubGlobal('innerHeight', 640)
    vi.stubGlobal('visualViewport', undefined)
    anchorFloating(reference, floating)
    await flush()
    expect(fl.passes.map((p) => p.crossAxis)).toEqual([false, true])
    vi.unstubAllGlobals()
  })

  it('выше экрана: места у кнопки хватает — прокручивается у неё, совсем мало — поверх', async () => {
    const { reference, floating } = pair()
    vi.stubGlobal('innerHeight', 640)
    vi.stubGlobal('visualViewport', undefined)
    fl.height = 900
    fl.room = 260
    anchorFloating(reference, floating)
    await flush()
    expect(fl.passes.map((p) => p.crossAxis)).toEqual([false])
    fl.room = 200
    anchorFloating(reference, floating)
    await flush()
    expect(fl.passes.map((p) => p.crossAxis)).toEqual([false, false, true])
    vi.unstubAllGlobals()
  })

  it('список поля и панель на месте поле не накрывают', async () => {
    const { reference, floating } = pair()
    fl.room = 100
    anchorFloating(reference, floating, { matchWidth: 'exact' })
    anchorFloating(reference, floating, { strategy: 'absolute' })
    await flush()
    expect(fl.passes.map((p) => p.crossAxis)).toEqual([false, false])
  })

  it('обходит вырезы, а панель на месте — ещё шапку и нижнюю панель', async () => {
    const { reference, floating } = pair()
    anchorFloating(reference, floating)
    await flush()
    const safe = { top: 48, right: 8, bottom: 42, left: 8 }
    expect(fl.paddings).toEqual([safe, safe, safe])
    anchorFloating(reference, floating, { strategy: 'absolute', padding: 0 })
    await flush()
    const covered = { top: 64, right: 0, bottom: 50, left: 0 }
    expect(fl.paddings).toEqual([covered, covered, covered])
  })

  it('зазор и сдвиг вдоль кнопки', async () => {
    const { reference, floating } = pair()
    anchorFloating(reference, floating, { offset: 13, alignOffset: 12 })
    await flush()
    expect(fl.offset).toEqual({ mainAxis: 13, alignmentAxis: 12 })
    anchorFloating(reference, floating)
    await flush()
    expect(fl.offset).toEqual({ mainAxis: 4, alignmentAxis: null })
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
