// Клавиатура открывается только для полей, в которые печатают: флажок,
// кнопка или заблокированное поле её не вызывают.

import { describe, expect, it } from 'vitest'

import { isTextField } from './use-soft-keyboard'

function input(type: string, attrs: Record<string, boolean> = {}): HTMLInputElement {
  const el = document.createElement('input')
  el.type = type
  Object.assign(el, attrs)
  return el
}

describe('isTextField', () => {
  it('текстовые поля и textarea', () => {
    expect(isTextField(input('text'))).toBe(true)
    expect(isTextField(input('search'))).toBe(true)
    expect(isTextField(input('number'))).toBe(true)
    expect(isTextField(document.createElement('textarea'))).toBe(true)
  })

  it('не поля для печати', () => {
    expect(isTextField(input('checkbox'))).toBe(false)
    expect(isTextField(input('file'))).toBe(false)
    expect(isTextField(document.createElement('button'))).toBe(false)
    expect(isTextField(null)).toBe(false)
  })

  it('заблокированное или только для чтения', () => {
    expect(isTextField(input('text', { disabled: true }))).toBe(false)
    expect(isTextField(input('text', { readOnly: true }))).toBe(false)
  })
})
