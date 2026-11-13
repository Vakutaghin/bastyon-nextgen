// Переключатель вместо antd Switch: кнопка role="switch" с aria-checked;
// нажатие шлёт update:checked, change и click с новым значением и событием
// (как antd: header-tor берёт событие и гасит всплытие); выключенный и
// «сохраняется» не нажимаются; без checked помнит состояние сам.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Switch from './index'

describe('Switch', () => {
  it('управляемый: показывает checked и шлёт новое значение, сам не меняется', async () => {
    const w = mount(Switch, {
      props: { checked: false },
      attrs: { 'aria-label': 'Звук', id: 'snd' },
    })
    const btn = w.get('button')
    expect(btn.attributes('role')).toBe('switch')
    expect(btn.attributes('aria-checked')).toBe('false')
    expect(btn.attributes('aria-label')).toBe('Звук')
    expect(btn.attributes('id')).toBe('snd')

    await btn.trigger('click')
    expect(w.emitted('update:checked')).toEqual([[true]])
    expect(w.emitted('change')![0]![0]).toBe(true)
    expect(w.emitted('change')![0]![1]).toBeInstanceOf(MouseEvent)
    expect(w.emitted('click')![0]![0]).toBe(true)
    expect(btn.attributes('aria-checked')).toBe('false')

    await w.setProps({ checked: true })
    expect(btn.attributes('aria-checked')).toBe('true')
    expect(btn.attributes('data-state')).toBe('on')
  })

  it('без checked переключается сам', async () => {
    const w = mount(Switch)
    await w.get('button').trigger('click')
    expect(w.get('button').attributes('aria-checked')).toBe('true')
    await w.get('button').trigger('click')
    expect(w.get('button').attributes('aria-checked')).toBe('false')
  })

  it('disabled и loading — кнопка выключена, событий нет; loading — значок в бегунке', async () => {
    const w = mount(Switch, { props: { checked: true, loading: true } })
    const btn = w.get('button')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('aria-busy')).toBe('true')
    expect(w.find('.ui-switch__thumb .ui-icon-spin').exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('change')).toBeUndefined()

    await w.setProps({ loading: false, disabled: true })
    expect(w.find('.ui-icon-spin').exists()).toBe(false)
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('маленький — data-size', () => {
    expect(
      mount(Switch, { props: { size: 'small' } })
        .get('button')
        .attributes('data-size')
    ).toBe('small')
  })
})
