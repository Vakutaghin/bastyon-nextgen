// Свой Spin вместо antd: значок по умолчанию крутится, свой — слотом
// #indicator, подпись tip под значком. Для диктора — role="status" и подпись
// (или «Загрузка», если подписи нет); сам значок от диктора скрыт.

import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { beforeAll, describe, expect, it } from 'vitest'
import { setI18nLocale } from '@/i18n'
import Spin from './index'

beforeAll(() => setI18nLocale('ru'))

describe('Spin', () => {
  it('без подписи: крутящийся значок и «Загрузка» для диктора', () => {
    const w = mount(Spin)
    const root = w.get('.ui-spin')
    expect(root.attributes('role')).toBe('status')
    expect(root.attributes('aria-label')).toBe('Загрузка')
    expect(root.attributes('data-size')).toBe('default')
    expect(w.get('.ui-spin__indicator').attributes('aria-hidden')).toBe('true')
    expect(w.find('.ui-icon-spin').exists()).toBe(true)
    expect(w.find('.ui-spin__tip').exists()).toBe(false)
  })

  it('подпись — под значком и вместо aria-label', () => {
    const w = mount(Spin, { props: { tip: 'Загрузка ленты…', size: 'small' } })
    expect(w.get('.ui-spin__tip').text()).toBe('Загрузка ленты…')
    expect(w.get('.ui-spin').attributes('aria-label')).toBeUndefined()
    expect(w.get('.ui-spin').attributes('data-size')).toBe('small')
  })

  it('свой значок — слотом #indicator', () => {
    const w = mount(Spin, { slots: { indicator: () => h('i', { class: 'mine' }) } })
    expect(w.find('.ui-spin__indicator .mine').exists()).toBe(true)
    expect(w.find('.ui-icon-spin').exists()).toBe(false)
  })
})
