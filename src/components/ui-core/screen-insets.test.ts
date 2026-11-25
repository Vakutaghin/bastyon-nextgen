// Занятое место у краёв экрана: вырезы — всем панелям, шапка и нижняя панель —
// только тем, что рисуются на странице и лежат ниже них.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { coveredInsets, safeInsets } from './screen-insets'

type Box = { top: number; bottom: number; left: number; right: number }

function element(box: Box, style: Partial<CSSStyleDeclaration> = {}, edge?: string): HTMLElement {
  const el = document.createElement('div')
  Object.assign(el.style, style)
  if (edge) el.dataset.screenEdge = edge
  el.getBoundingClientRect = () =>
    ({ ...box, width: box.right - box.left, height: box.bottom - box.top }) as DOMRect
  document.body.append(el)
  return el
}

const SCREEN = { width: 400, height: 800 }
const header = (z = '1000') =>
  element({ top: 0, bottom: 64, left: 0, right: 400 }, { position: 'fixed', zIndex: z }, 'top')
const nav = () =>
  element(
    { top: 740, bottom: 800, left: 0, right: 400 },
    { position: 'fixed', zIndex: '1000' },
    'bottom'
  )
const field = (style: Partial<CSSStyleDeclaration> = {}) =>
  element({ top: 300, bottom: 340, left: 20, right: 380 }, style)

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('safeInsets', () => {
  it('отступы пробы — числа; проба на странице одна', () => {
    safeInsets()
    const probe = document.getElementById('ui-safe-probe')!
    probe.style.padding = '24px 10px 34px 5px'
    expect(safeInsets()).toEqual({ top: 24, right: 10, bottom: 34, left: 5 })
    expect(document.querySelectorAll('#ui-safe-probe')).toHaveLength(1)
    expect(probe.style.visibility).toBe('hidden')
  })
})

describe('coveredInsets', () => {
  it('поле на странице: шапка сверху и панель разделов снизу — заняты', () => {
    vi.stubGlobal('innerHeight', SCREEN.height)
    header()
    nav()
    expect(coveredInsets(field())).toMatchObject({ top: 64, bottom: 60 })
  })

  it('поле в окне поверх шапки — ничего не занято', () => {
    vi.stubGlobal('innerHeight', SCREEN.height)
    header()
    nav()
    expect(coveredInsets(field({ position: 'fixed', zIndex: '2000' }))).toMatchObject({
      top: 0,
      bottom: 0,
    })
  })

  it('поле в самой шапке её не обходит, а панель того же слоя не мешает', () => {
    vi.stubGlobal('innerHeight', SCREEN.height)
    const head = header()
    nav()
    const inside = document.createElement('div')
    inside.getBoundingClientRect = () =>
      ({ top: 10, bottom: 50, left: 20, right: 380, width: 360, height: 40 }) as DOMRect
    head.append(inside)
    expect(coveredInsets(inside)).toMatchObject({ top: 0, bottom: 0 })
  })

  it('край, который не над полем (мини-плеер в углу) или скрыт, не считается', () => {
    vi.stubGlobal('innerHeight', SCREEN.height)
    element(
      { top: 700, bottom: 800, left: 0, right: 15 },
      { position: 'fixed', zIndex: '1020' },
      'bottom'
    )
    element(
      { top: 0, bottom: 0, left: 0, right: 0 },
      { position: 'fixed', zIndex: '1000' },
      'bottom'
    )
    expect(coveredInsets(field())).toMatchObject({ top: 0, bottom: 0 })
  })
})
