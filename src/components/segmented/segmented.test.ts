// Переключатель вариантов вместо antd Segmented: варианты строками или
// объектами, выбор — update:value и change(value), стрелки выбирают соседний
// доступный вариант (выключенный пропускают), Tab попадает на выбранный.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Segmented from './index'
import { normalizeOptions, stepIndex } from './segmented'

const OPTIONS = [
  { value: 'auto', label: 'Авто' },
  { value: 'direct', label: 'Напрямую', disabled: true },
  { value: 'tor', label: 'Tor' },
]

describe('normalizeOptions / stepIndex', () => {
  it('строки и числа — подпись и значение сразу', () => {
    expect(normalizeOptions(['a', 4])).toEqual([
      { label: 'a', value: 'a', disabled: false },
      { label: '4', value: 4, disabled: false },
    ])
  })

  it('стрелка пропускает выключенный и идёт по кругу', () => {
    const items = normalizeOptions(OPTIONS)
    expect(stepIndex(items, 0, 1)).toBe(2)
    expect(stepIndex(items, 2, 1)).toBe(0)
    expect(stepIndex(items, 0, -1)).toBe(2)
  })
})

describe('Segmented', () => {
  it('radiogroup из кнопок-радио; выбранный — aria-checked и в Tab', () => {
    const w = mount(Segmented, {
      props: { options: OPTIONS, value: 'tor' },
      attrs: { 'aria-label': 'Сеть' },
    })
    expect(w.get('.ui-segmented').attributes('role')).toBe('radiogroup')
    expect(w.get('.ui-segmented').attributes('aria-label')).toBe('Сеть')
    const items = w.findAll('[role="radio"]')
    expect(items.map((i) => i.attributes('aria-checked'))).toEqual(['false', 'false', 'true'])
    expect(items.map((i) => i.attributes('tabindex'))).toEqual(['-1', '-1', '0'])
    expect(items[1]!.attributes('disabled')).toBeDefined()
  })

  it('нажатие шлёт значение; по выбранному — ничего', async () => {
    const w = mount(Segmented, { props: { options: OPTIONS, value: 'tor' } })
    const items = w.findAll('[role="radio"]')
    await items[2]!.trigger('click')
    expect(w.emitted('change')).toBeUndefined()
    await items[0]!.trigger('click')
    expect(w.emitted('update:value')).toEqual([['auto']])
    expect(w.emitted('change')).toEqual([['auto']])
  })

  it('стрелка вправо выбирает следующий доступный', async () => {
    const w = mount(Segmented, { props: { options: OPTIONS, value: 'auto' } })
    await w.findAll('[role="radio"]')[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('change')).toEqual([['tor']])
  })

  it('выключенный целиком — все кнопки disabled, стрелки молчат', async () => {
    const w = mount(Segmented, { props: { options: OPTIONS, value: 'auto', disabled: true } })
    const items = w.findAll('[role="radio"]')
    expect(items.every((i) => i.attributes('disabled') !== undefined)).toBe(true)
    await items[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('change')).toBeUndefined()
  })
})
