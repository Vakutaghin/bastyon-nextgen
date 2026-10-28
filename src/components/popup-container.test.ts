// Выпадающая панель поля рисуется над слоем, в котором стоит поле: в окне
// модалки — в его обёртке, в меню телефона — в нём самом, иначе — в body.

import { describe, expect, it } from 'vitest'
import { popupContainer } from './popup-container'

function inside(html: string): HTMLElement {
  document.body.innerHTML = html
  return document.getElementById('trigger')!
}

describe('popupContainer', () => {
  it('в окне модалки — обёртка окна', () => {
    const trigger = inside('<div class="ant-modal-wrap" id="w"><span id="trigger"></span></div>')
    expect(popupContainer(trigger).id).toBe('w')
  })

  it('в слое с data-popup-host — сам слой', () => {
    const trigger = inside(
      '<aside data-popup-host id="d"><div><span id="trigger"></span></div></aside>'
    )
    expect(popupContainer(trigger).id).toBe('d')
  })

  it('иначе — body', () => {
    expect(popupContainer(inside('<span id="trigger"></span>'))).toBe(document.body)
  })
})
