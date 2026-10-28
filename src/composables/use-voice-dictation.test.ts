import { afterEach, describe, expect, it, vi } from 'vitest'

import { draftDictated, insertDictated } from './use-voice-dictation'

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

  it('в заблокированное поле хвост распознавания не пишется', () => {
    const onInput = vi.fn()
    const locked = field('Пост уже публикуется')
    locked.disabled = true
    const readOnly = field('Только для чтения')
    readOnly.readOnly = true
    for (const el of [locked, readOnly]) {
      el.addEventListener('input', onInput)
      insertDictated(el, 'и ещё немного', 'ru')
    }
    expect(locked.value).toBe('Пост уже публикуется')
    expect(readOnly.value).toBe('Только для чтения')
    expect(onInput).not.toHaveBeenCalled()
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

describe('черновик по ходу речи', () => {
  it('растёт на месте курсора, текст фразы встаёт на его место', () => {
    const el = field('Итак')
    const onInput = vi.fn()
    el.addEventListener('input', onInput)
    let d = draftDictated(el, 'Встречаемся', 'ru', 0, null)
    expect(el.value).toBe('Итак встречаемся')
    d = draftDictated(el, 'Встречаемся в семь', 'ru', 0, d)
    expect(el.value).toBe('Итак встречаемся в семь')
    expect(el.selectionStart).toBe(el.value.length)
    insertDictated(el, 'Встречаемся в семь. Точка.', 'ru', d)
    expect(el.value).toBe('Итак встречаемся в семь.')
    expect(el.selectionStart).toBe(el.value.length)
    expect(onInput).toHaveBeenCalledTimes(3)
  })

  it('пустой текст фразы убирает черновик', () => {
    const el = field('Привет.')
    const d = draftDictated(el, 'Продолжение следует', 'ru', 0, null)
    expect(el.value).toBe('Привет. Продолжение следует')
    insertDictated(el, '', 'ru', d)
    expect(el.value).toBe('Привет.')
  })

  it('курсор переставили — черновик меняется на своём месте, курсор остаётся', () => {
    const el = field('Начало конец', 6)
    let d = draftDictated(el, 'середина', 'ru', 0, null)
    expect(el.value).toBe('Начало середина конец')
    el.setSelectionRange(0, 0)
    d = draftDictated(el, 'середина текста', 'ru', 0, d)
    expect(el.value).toBe('Начало середина текста конец')
    expect(el.selectionStart).toBe(0)
    insertDictated(el, 'середина текста', 'ru', d)
    expect(el.value).toBe('Начало середина текста конец')
    expect(el.selectionStart).toBe(0)
  })

  it('текст перед черновиком дописали — черновик находится по тексту', () => {
    const el = field('Раз.')
    const d = draftDictated(el, 'два', 'ru', 0, null)
    expect(el.value).toBe('Раз. Два')
    el.setRangeText('Ноль. ', 0, 0, 'preserve')
    insertDictated(el, 'Два, три.', 'ru', d)
    expect(el.value).toBe('Ноль. Раз. Два, три.')
  })

  it('черновик стёрли — текст фразы встаёт в позицию курсора', () => {
    const el = field('Текст')
    const d = draftDictated(el, 'лишнее', 'ru', 0, null)
    el.value = 'Текст'
    el.setSelectionRange(5, 5)
    insertDictated(el, 'и ещё', 'ru', d)
    expect(el.value).toBe('Текст и ещё')
  })

  it('в заблокированное поле черновик не пишется', () => {
    const el = field('Пост публикуется')
    el.disabled = true
    expect(draftDictated(el, 'ещё', 'ru', 0, null)).toBeNull()
    expect(el.value).toBe('Пост публикуется')
  })
})
