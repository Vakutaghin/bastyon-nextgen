// Кнопка «Перейти к дате»: выбранный день — полночь по местному времени;
// мышью — сразу, касанием — когда барабан остановился; открыли снова — поле
// пустое, тот же день — тоже переход.

import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'
import DateJumpButton from './date-jump-button.vue'

function render() {
  return mount(DateJumpButton, {
    props: { max: '2026-11-11' },
    global: { plugins: [i18n], provide: { theme: {} } },
  })
}

function choose(input: HTMLInputElement, value: string): void {
  input.value = value
  input.dispatchEvent(new Event('change'))
}

function press(input: HTMLInputElement, pointerType: string): void {
  const e = new Event('pointerdown') as Event & { pointerType: string }
  Object.defineProperty(e, 'pointerType', { value: pointerType })
  input.dispatchEvent(e)
}

beforeAll(() => setI18nLocale('ru'))
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('DateJumpButton', () => {
  it('мышью: щелчок открывает календарь, выбранный день — сразу, полночь по местному', () => {
    const w = render()
    const input = w.get('input').element as HTMLInputElement
    const showPicker = vi.fn()
    Object.assign(input, { showPicker })
    expect(input.getAttribute('max')).toBe('2026-11-11')
    press(input, 'mouse')
    input.click()
    expect(showPicker).toHaveBeenCalledTimes(1)
    choose(input, '2026-08-12')
    expect(w.emitted('pick')).toEqual([[new Date(2026, 7, 12).getTime()]])
  })

  it('касанием: календарь открывает система; переход — когда перестали крутить', () => {
    const w = render()
    const input = w.get('input').element as HTMLInputElement
    const showPicker = vi.fn()
    Object.assign(input, { showPicker })
    press(input, 'touch')
    input.click()
    expect(showPicker).not.toHaveBeenCalled()
    choose(input, '2026-08-10')
    choose(input, '2026-08-11')
    vi.advanceTimersByTime(500)
    choose(input, '2026-08-12')
    expect(w.emitted('pick')).toBeUndefined()
    vi.advanceTimersByTime(700)
    expect(w.emitted('pick')).toEqual([[new Date(2026, 7, 12).getTime()]])
  })

  it('input и change об одном выборе — один переход; Safari может прислать только input', () => {
    const w = render()
    const input = w.get('input').element as HTMLInputElement
    press(input, 'mouse')
    input.value = '2026-08-12'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new Event('change'))
    expect(w.emitted('pick')).toHaveLength(1)
  })

  it('открыли снова — поле пустое: тот же день ещё раз — тоже переход', () => {
    const w = render()
    const input = w.get('input').element as HTMLInputElement
    press(input, 'mouse')
    choose(input, '2026-08-12')
    press(input, 'mouse')
    expect(input.value).toBe('')
    choose(input, '2026-08-12')
    expect(w.emitted('pick')).toHaveLength(2)
  })
})
