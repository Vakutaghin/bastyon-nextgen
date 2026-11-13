// Своя полоса прогресса вместо antd: role="progressbar" с aria-valuenow,
// ширина заполнения из percent (прижатого к 0–100) сразу при показе и при
// каждом изменении, число справа — только с showInfo, «в работе» и размер —
// атрибутами для стилей.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Progress from './index'
import { clampPercent } from './progress'

describe('clampPercent', () => {
  it('прижимает к 0–100, мусор — 0', () => {
    expect(clampPercent(42.5)).toBe(42.5)
    expect(clampPercent(-5)).toBe(0)
    expect(clampPercent(140)).toBe(100)
    expect(clampPercent(Number.NaN)).toBe(0)
    expect(clampPercent(undefined)).toBe(0)
  })
})

describe('Progress', () => {
  it('ширина и aria-valuenow — сразу при показе и при смене percent', async () => {
    const w = mount(Progress, { props: { percent: 40.4, showInfo: false } })
    const root = w.get('.ui-progress')
    const fill = w.get('.ui-progress__fill').element as HTMLElement
    expect(root.attributes('role')).toBe('progressbar')
    expect(root.attributes('aria-valuenow')).toBe('40')
    expect(fill.style.width).toBe('40.4%')

    await w.setProps({ percent: 120 })
    expect(fill.style.width).toBe('100%')
    expect(root.attributes('aria-valuenow')).toBe('100')
  })

  it('число справа — только с showInfo', async () => {
    const w = mount(Progress, { props: { percent: 30 } })
    expect(w.get('.ui-progress__info').text()).toBe('30%')
    await w.setProps({ showInfo: false })
    expect(w.find('.ui-progress__info').exists()).toBe(false)
  })

  it('status и size — data-атрибутами', () => {
    const w = mount(Progress, { props: { status: 'active', size: 'small' } })
    expect(w.get('.ui-progress').attributes('data-status')).toBe('active')
    expect(w.get('.ui-progress').attributes('data-size')).toBe('small')
  })
})
