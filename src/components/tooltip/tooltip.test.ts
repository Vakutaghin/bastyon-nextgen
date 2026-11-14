// Подсказка: наведение мышью с задержкой (касание — нет), фокус только после
// клавиатуры, закрепление нажатием, Esc, aria-describedby, без своего узла
// вокруг кнопки.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { Z_INDEX } from '@/styles/design-tokens'
import { openLayers, resetLayersForTests } from '@/components/ui-core/layer-stack'

vi.mock('@floating-ui/dom', () => ({
  autoUpdate: () => () => {},
  computePosition: async () => ({ x: 10, y: 20, placement: 'top' }),
  flip: () => ({}),
  offset: () => ({}),
  shift: () => ({}),
  size: () => ({}),
}))

import Tooltip from './tooltip.vue'
import type { TooltipProps } from './types'

const mounted: VueWrapper[] = []

function mountTip(props: TooltipProps & Record<string, unknown>, label?: string) {
  const w = mount(
    defineComponent({
      setup: () => () =>
        h('div', { class: 'parent' }, [
          h(Tooltip, props, {
            default: () => h('button', { type: 'button', 'aria-label': label }, 'Кнопка'),
          }),
        ]),
    }),
    { attachTo: document.body }
  )
  mounted.push(w)
  return w.element.querySelector('button') as HTMLButtonElement
}

function tip(): HTMLElement | null {
  return document.querySelector('.ui-tooltip')
}

function pointer(el: Element, type: string, pointerType = 'mouse'): void {
  const e = new Event(type, { bubbles: type === 'pointerdown' })
  Object.assign(e, { pointerType })
  el.dispatchEvent(e)
}

function key(name: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  resetLayersForTests()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('Tooltip', () => {
  it('кнопка — сам элемент из слота, без обёртки', () => {
    const button = mountTip({ title: 'Подсказка' })
    expect(button.parentElement?.className).toBe('parent')
  })

  it('мышь: через 0,1 с подсказка в слое подсказок; ушла — закрылась', async () => {
    const button = mountTip({ title: 'Тёмная тема' })
    pointer(button, 'pointerenter')
    await nextTick()
    expect(tip()).toBeNull()
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(tip()?.textContent?.trim()).toBe('Тёмная тема')
    expect(tip()?.getAttribute('role')).toBe('tooltip')
    expect(tip()?.closest('#ui-layers')).not.toBeNull()
    expect(openLayers().map((l) => [l.kind, l.zIndex])).toEqual([['tooltip', Z_INDEX.TOOLTIP]])
    pointer(button, 'pointerleave')
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(openLayers()).toHaveLength(0)
  })

  it('mouseEnterDelay; курсор перешёл на подсказку — она остаётся', async () => {
    const button = mountTip({ title: 'Голосовой ввод', mouseEnterDelay: 0.3 })
    pointer(button, 'pointerenter')
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(tip()).toBeNull()
    vi.advanceTimersByTime(100)
    await nextTick()
    pointer(button, 'pointerleave')
    pointer(tip()!, 'pointerenter')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(openLayers()).toHaveLength(1)
  })

  it('касание по наведению не открывает', async () => {
    const button = mountTip({ title: 'Подсказка' })
    pointer(button, 'pointerenter', 'touch')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(openLayers()).toHaveLength(0)
  })

  it('фокус открывает только после клавиатуры', async () => {
    const button = mountTip({ title: 'Подсказка' })
    pointer(document.body, 'pointerdown', 'touch')
    button.focus()
    await nextTick()
    expect(openLayers()).toHaveLength(0)
    button.blur()
    key('Tab')
    button.focus()
    await nextTick()
    expect(openLayers()).toHaveLength(1)
    button.blur()
    await nextTick()
    expect(openLayers()).toHaveLength(0)
  })

  it('Esc закрывает', async () => {
    const button = mountTip({ title: 'Подсказка' })
    key('Tab')
    button.focus()
    await nextTick()
    key('Escape')
    await nextTick()
    expect(openLayers()).toHaveLength(0)
  })

  it('click: нажатие закрепляет, уход курсора не убирает, нажатие мимо — убирает', async () => {
    const button = mountTip({ title: 'Справка', trigger: ['hover', 'focus', 'click'] })
    button.click()
    await nextTick()
    expect(openLayers()).toHaveLength(1)
    pointer(button, 'pointerleave')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(openLayers()).toHaveLength(1)
    pointer(tip()!, 'pointerdown')
    await nextTick()
    expect(openLayers()).toHaveLength(1)
    pointer(document.body, 'pointerdown')
    await nextTick()
    expect(openLayers()).toHaveLength(0)
    button.click()
    await nextTick()
    button.click()
    await nextTick()
    expect(openLayers()).toHaveLength(0)
  })

  it('без click в trigger нажатие не открывает; пустой title — подсказки нет', async () => {
    const button = mountTip({ title: '' })
    key('Tab')
    button.focus()
    button.click()
    pointer(button, 'pointerenter')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(openLayers()).toHaveLength(0)
  })

  it('aria-describedby — пока открыта и если текст не равен подписи кнопки', async () => {
    const plain = mountTip({ title: 'Назад: Главная' }, 'Назад')
    const same = mountTip({ title: 'Тёмная тема' }, 'Тёмная тема')
    key('Tab')
    plain.focus()
    await nextTick()
    expect(plain.getAttribute('aria-describedby')).toBe(tip()!.id)
    same.focus()
    await nextTick()
    expect(plain.hasAttribute('aria-describedby')).toBe(false)
    expect(same.hasAttribute('aria-describedby')).toBe(false)
  })

  it('свой ref и обработчики кнопки сохраняются', async () => {
    const own = ref<HTMLElement | null>(null)
    const onClick = vi.fn()
    const w = mount(
      defineComponent({
        setup: () => () =>
          h(Tooltip, { title: 'Т' }, { default: () => h('button', { ref: own, onClick }, 'К') }),
      }),
      { attachTo: document.body }
    )
    mounted.push(w)
    await nextTick()
    expect(own.value?.tagName).toBe('BUTTON')
    own.value!.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
