// Выпадающая панель поля рисуется в слое, в котором стоит поле (корень окна,
// шторки, меню телефона — data-popup-host), иначе — в body.

import { describe, expect, it } from 'vitest'
import { popupContainer } from './popup-container'

function inside(html: string): HTMLElement {
  document.body.innerHTML = html
  return document.getElementById('trigger')!
}

describe('popupContainer', () => {
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
