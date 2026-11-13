// Флажок вместо antd Checkbox: настоящий input type="checkbox" внутри
// <label> — нажатие по подписи переключает; v-model:checked; выключенный не
// переключается; атрибуты потребителя — на input.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { UI } from '@/components/testing/ui-selectors'
import Checkbox from './index'

describe('Checkbox', () => {
  it('нажатие шлёт update:checked и change; checked управляет input', async () => {
    const w = mount(Checkbox, {
      props: { checked: false },
      attrs: { 'data-testid': 'skip' },
      slots: { default: 'Больше не спрашивать' },
    })
    const input = w.get(UI.checkboxInput)
    expect(input.attributes('data-testid')).toBe('skip')
    expect((input.element as HTMLInputElement).checked).toBe(false)
    expect(w.get('label').text()).toBe('Больше не спрашивать')

    await input.setValue(true)
    expect(w.emitted('update:checked')).toEqual([[true]])
    expect(w.emitted('change')).toEqual([[true]])

    await w.setProps({ checked: true })
    expect((input.element as HTMLInputElement).checked).toBe(true)
  })

  it('выключенный — input disabled, подпись приглушена', () => {
    const w = mount(Checkbox, { props: { disabled: true }, slots: { default: 'Нет' } })
    expect(w.get(UI.checkboxInput).attributes('disabled')).toBeDefined()
    expect(w.get('.ui-checkbox').attributes('data-disabled')).toBe('')
  })

  it('без подписи — без пустого span', () => {
    expect(mount(Checkbox).find('.ui-checkbox__label').exists()).toBe(false)
  })
})
