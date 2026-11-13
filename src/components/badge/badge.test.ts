// Счётчик в углу значка вместо antd Badge: 0 — счётчика нет, больше max —
// «max+», содержимое (значок) остаётся всегда.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Badge from './index'
import { badgeText } from './badge'

describe('badgeText', () => {
  it('пусто для нуля и мусора, «99+» сверх максимума', () => {
    expect(badgeText(0)).toBe('')
    expect(badgeText(-3)).toBe('')
    expect(badgeText(Number.NaN)).toBe('')
    expect(badgeText(undefined)).toBe('')
    expect(badgeText(7)).toBe('7')
    expect(badgeText(99)).toBe('99')
    expect(badgeText(100)).toBe('99+')
    expect(badgeText(12, 9)).toBe('9+')
  })
})

describe('Badge', () => {
  it('значок — всегда, счётчик — только при count > 0', async () => {
    const w = mount(Badge, { props: { count: 0 }, slots: { default: '<i class="bell" />' } })
    expect(w.find('.bell').exists()).toBe(true)
    expect(w.find('.ui-badge__count').exists()).toBe(false)

    await w.setProps({ count: 3 })
    expect(w.get('.ui-badge__count').text()).toBe('3')
    expect(w.get('.ui-badge__count').attributes('data-wide')).toBeUndefined()

    await w.setProps({ count: 150 })
    expect(w.get('.ui-badge__count').text()).toBe('99+')
    expect(w.get('.ui-badge__count').attributes('data-wide')).toBe('')
  })
})
