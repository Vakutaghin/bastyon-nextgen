// Плашка вместо antd Alert: вид — data-type, значок — по виду и только с
// showIcon, заголовок и текст — пропом и слотами. role="alert" — только у
// ошибки: подсказку диктор не должен выкрикивать при открытии окна.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Alert from './index'

describe('Alert', () => {
  it('info по умолчанию, без значка и без role', () => {
    const w = mount(Alert, { slots: { description: 'Подсказка' } })
    const root = w.get('.ui-alert')
    expect(root.attributes('data-type')).toBe('info')
    expect(root.attributes('role')).toBeUndefined()
    expect(w.find('.ui-alert__icon').exists()).toBe(false)
    expect(w.get('.ui-alert__description').text()).toBe('Подсказка')
    expect(w.find('.ui-alert__title').exists()).toBe(false)
  })

  it('заголовок пропом, текст слотом по умолчанию, значок с showIcon', () => {
    const w = mount(Alert, {
      props: { type: 'warning', title: 'Внимание', showIcon: true },
      slots: { default: 'Текст' },
    })
    expect(w.get('.ui-alert__title').text()).toBe('Внимание')
    expect(w.get('.ui-alert__description').text()).toBe('Текст')
    expect(w.find('.ui-alert__icon').exists()).toBe(true)
  })

  it('ошибка — role="alert"', () => {
    const w = mount(Alert, { props: { type: 'error' }, slots: { default: 'Сбой' } })
    expect(w.get('.ui-alert').attributes('role')).toBe('alert')
  })
})
