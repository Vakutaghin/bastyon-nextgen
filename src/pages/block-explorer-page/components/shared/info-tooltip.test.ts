import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { Tooltip } from 'ant-design-vue'
import { i18n } from '@/i18n'
import InfoTooltip from './info-tooltip.vue'
import { EXPLORER_GLOSSARY } from './explorer-glossary'

// shallowMount авто-стабит ant Tooltip — не тащим его internals (ResizeObserver/raf,
// которых нет в happy-dom). Проверяем вычисленный `title`, который компонент
// прокидывает в Tooltip: findComponent находит стаб и читает его prop.
function mountTooltip(props: Record<string, unknown>) {
  return shallowMount(InfoTooltip, { props, global: { plugins: [i18n] } })
}

function tooltipTitle(props: Record<string, unknown>): unknown {
  return mountTooltip(props).findComponent(Tooltip).props('title')
}

describe('info-tooltip', () => {
  it('resolves a glossary term-key to its localized text', () => {
    const expected = i18n.global.t(EXPLORER_GLOSSARY.height)
    expect(expected.length).toBeGreaterThan(0)
    expect(tooltipTitle({ termKey: 'height' })).toBe(expected)
  })

  it('uses a raw text prop verbatim', () => {
    expect(tooltipTitle({ text: 'Custom explanation' })).toBe('Custom explanation')
  })

  it('prefers raw text over term-key when both are given', () => {
    expect(tooltipTitle({ text: 'Wins', termKey: 'height' })).toBe('Wins')
  })

  it('renders an empty title when neither prop is given', () => {
    expect(tooltipTitle({})).toBe('')
  })
})
