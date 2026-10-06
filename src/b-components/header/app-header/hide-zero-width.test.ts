import { describe, expect, it } from 'vitest'

import { hideZeroWidthChildren } from './hide-zero-width'

/** jsdom не считает раскладку: ширину задаём сами, `display: none` — это 0. */
function layout(el: HTMLElement, width: () => number): void {
  el.getBoundingClientRect = () => ({ width: el.style.display === 'none' ? 0 : width() }) as DOMRect
  el.getClientRects = () =>
    (el.style.display === 'none' || width() === 0 ? [] : [{}]) as unknown as DOMRectList
}

function header(widths: number[]) {
  const state = { visible: true }
  const row = document.createElement('div')
  layout(row, () => (state.visible ? 300 : 0))
  const children = widths.map((w) => {
    const child = document.createElement('div')
    layout(child, () => (state.visible ? w : 0))
    row.appendChild(child)
    return child
  })
  return { row, children, state }
}

describe('hideZeroWidthChildren', () => {
  it('прячет пустые обёртки, кнопки оставляет', () => {
    const { row, children } = header([32, 0, 107])
    hideZeroWidthChildren(row)
    expect(children.map((c) => c.style.display)).toEqual(['', 'none', ''])
  })

  it('скрытую шапку не трогает: после мини-приложения кнопки на месте', () => {
    const { row, children, state } = header([32, 0, 107])
    hideZeroWidthChildren(row)
    state.visible = false
    hideZeroWidthChildren(row)
    state.visible = true
    hideZeroWidthChildren(row)
    expect(children.map((c) => c.style.display)).toEqual(['', 'none', ''])
  })

  it('спрятанный раньше элемент возвращается, когда у него появилась ширина', () => {
    const { row, children } = header([32, 107])
    children[1]!.style.display = 'none'
    hideZeroWidthChildren(row)
    expect(children[1]!.style.display).toBe('')
  })
})
