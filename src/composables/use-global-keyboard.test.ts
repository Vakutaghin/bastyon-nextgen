import { describe, expect, it } from 'vitest'
import { isHotkeyBlockedBy } from './use-global-keyboard'

function el(html: string): Element {
  const holder = document.createElement('div')
  holder.innerHTML = html
  return holder.firstElementChild!
}

// S23: обработчик висел в capture и звал stopPropagation — Space и M не
// доходили до кнопок, select'ов, модалок и собственных хоткеев плеера.
describe('isHotkeyBlockedBy', () => {
  it('поля ввода и кнопки обрабатывают клавиши сами', () => {
    expect(isHotkeyBlockedBy(el('<input>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<textarea></textarea>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<select><option>a</option></select>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<button>ok</button>'))).toBe(true)
  })

  it('ссылка с href — тоже', () => {
    expect(isHotkeyBlockedBy(el('<a href="/x">x</a>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<a>без href</a>'))).toBe(false)
  })

  it('contenteditable', () => {
    expect(isHotkeyBlockedBy(el('<div contenteditable="true">x</div>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<div contenteditable="">x</div>'))).toBe(true)
  })

  it('элементы с интерактивной ролью', () => {
    expect(isHotkeyBlockedBy(el('<div role="button">x</div>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<div role="slider">x</div>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<div role="presentation">x</div>'))).toBe(false)
  })

  it('внутри модалки клавиши принадлежат модалке', () => {
    const modal = el('<div role="dialog"><div><span id="deep">x</span></div></div>')
    document.body.appendChild(modal)
    expect(isHotkeyBlockedBy(modal.querySelector('#deep'))).toBe(true)
    modal.remove()
  })

  it('обычный текст на странице не блокирует хоткеи', () => {
    expect(isHotkeyBlockedBy(el('<p>просто текст</p>'))).toBe(false)
    expect(isHotkeyBlockedBy(null)).toBe(false)
  })
})
