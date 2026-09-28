import { afterEach, describe, expect, it, vi } from 'vitest'

import { insertDictated } from './use-voice-dictation'

function field(value: string, caret = value.length): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  document.body.appendChild(el)
  el.value = value
  el.setSelectionRange(caret, caret)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('insertDictated', () => {
  it('вставляет фразу в позицию курсора с командами и пробелами', () => {
    const el = field('Итак', 4)
    const onInput = vi.fn()
    el.addEventListener('input', onInput)
    insertDictated(el, 'Встречаемся в семь. Запятая. Не опаздывайте. Точка.', 'ru')
    expect(el.value).toBe('Итак встречаемся в семь, не опаздывайте.')
    expect(onInput).toHaveBeenCalled()
  })

  it('в середине текста: пробел перед словом после курсора', () => {
    const el = field('Привет мир', 7)
    insertDictated(el, 'дорогой', 'ru')
    expect(el.value).toBe('Привет дорогой мир')
  })

  it('новая фраза после точки — с большой буквы', () => {
    const el = field('Первое.')
    insertDictated(el, 'второе предложение.', 'ru')
    expect(el.value).toBe('Первое. Второе предложение.')
  })

  it('пустая фраза ничего не меняет', () => {
    const el = field('abc')
    const onInput = vi.fn()
    el.addEventListener('input', onInput)
    insertDictated(el, '   ', 'ru')
    expect(el.value).toBe('abc')
    expect(onInput).not.toHaveBeenCalled()
  })
})
