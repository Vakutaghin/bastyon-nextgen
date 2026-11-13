// Радиокнопки вместо antd Radio: группа даёт общее имя и выбранное значение
// кнопкам на любой глубине разметки; выбор — update:value и change(value).

import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import Radio, { RadioGroup } from './index'

const Host = defineComponent({
  props: { disabled: Boolean },
  emits: ['change'],
  setup(props, { emit }) {
    const value = ref<string | number>('b')
    return () =>
      h(
        RadioGroup,
        {
          value: value.value,
          disabled: props.disabled,
          'onUpdate:value': (v: string | number) => (value.value = v),
          onChange: (v: string | number) => emit('change', v),
        },
        () =>
          h('div', { class: 'nested' }, [
            h(Radio, { value: 'a' }, () => 'A'),
            h(Radio, { value: 'b' }, () => 'B'),
            h(Radio, { value: 'c', disabled: true }, () => 'C'),
          ])
      )
  },
})

const inputs = (w: ReturnType<typeof mount>) =>
  w.findAll('input[type="radio"]').map((i) => i.element as HTMLInputElement)

describe('RadioGroup + Radio', () => {
  it('общее имя и выбранное значение — кнопкам во вложенной разметке', () => {
    const w = mount(Host)
    const [a, b, c] = inputs(w)
    expect(w.get('.ui-radio-group').attributes('role')).toBe('radiogroup')
    expect(a!.name).toBeTruthy()
    expect(a!.name).toBe(b!.name)
    expect(b!.checked).toBe(true)
    expect(a!.checked).toBe(false)
    expect(c!.disabled).toBe(true)
  })

  it('выбор шлёт change со значением, а не событие', async () => {
    const w = mount(Host)
    await w.findAll('input[type="radio"]')[0]!.setValue(true)
    expect(w.emitted('change')).toEqual([['a']])
    expect(inputs(w)[0]!.checked).toBe(true)
    expect(inputs(w)[1]!.checked).toBe(false)
  })

  it('выключенная группа выключает все кнопки', () => {
    const w = mount(Host, { props: { disabled: true } })
    expect(inputs(w).every((i) => i.disabled)).toBe(true)
  })
})
