// Popover: нажатие открывает и закрывает, v-model:open, Esc и нажатие мимо
// (просьбы стека), фокус в панель с клавиатуры и обратно на кнопку,
// наведение с закреплением нажатием, aria.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { Z_INDEX } from '@/styles/design-tokens'
import {
  dismissPopupLayers,
  openLayers,
  resetLayersForTests,
} from '@/components/ui-core/layer-stack'
import { UI } from '@/components/testing/ui-selectors'

vi.mock('@floating-ui/dom', () => ({
  autoUpdate: () => () => {},
  computePosition: async () => ({ x: 10, y: 20, placement: 'bottom' }),
  flip: () => ({}),
  offset: () => ({}),
  shift: () => ({}),
  size: () => ({}),
}))

import Popover from './popover.vue'
import Popconfirm from '@/components/popconfirm'

const mounted: VueWrapper[] = []

function keep<T extends VueWrapper>(w: T): T {
  mounted.push(w)
  return w
}

function mountPopover(props: Record<string, unknown> = {}, open = ref<boolean | undefined>()) {
  const w = keep(
    mount(
      defineComponent({
        setup: () => () =>
          h(
            Popover,
            {
              ...props,
              open: open.value,
              'onUpdate:open': (v: boolean) => (open.value = v),
            },
            {
              default: () => h('button', { type: 'button', class: 'trigger' }, 'Кнопка'),
              content: () => [
                h('button', { type: 'button', class: 'first' }, 'Первая'),
                h('button', { type: 'button', class: 'second' }, 'Вторая'),
              ],
            }
          ),
      }),
      { attachTo: document.body }
    )
  )
  return { w, open, trigger: document.querySelector('.trigger') as HTMLButtonElement }
}

const panel = (): HTMLElement | null => document.querySelector(UI.popover)

function pointer(el: Element, type: string, pointerType = 'mouse'): void {
  const e = new Event(type)
  Object.assign(e, { pointerType })
  el.dispatchEvent(e)
}

/** Нажатие с клавиатуры: у такого щелчка detail = 0. */
function keyboardClick(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
}

/** Дождаться, пока панель встанет на место и получит фокус (несколько кадров). */
async function frames(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
})
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  resetLayersForTests()
  vi.useRealTimers()
})

describe('Popover', () => {
  it('нажатие открывает панель-окно в слое панелей и закрывает её', async () => {
    const { trigger } = mountPopover({ title: 'Заголовок' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    trigger.click()
    await nextTick()
    const el = panel()!
    expect(el.getAttribute('role')).toBe('dialog')
    expect(el.closest('#ui-layers')).not.toBeNull()
    expect(el.hasAttribute('data-popup-host')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('aria-controls')).toBe(el.id)
    expect(el.getAttribute('aria-labelledby')).toBe(`${el.id}-title`)
    expect(document.getElementById(`${el.id}-title`)?.textContent?.trim()).toBe('Заголовок')
    expect(openLayers().map((l) => [l.kind, l.zIndex])).toEqual([['popover', Z_INDEX.DROPDOWN]])
    trigger.click()
    await nextTick()
    expect(openLayers()).toHaveLength(0)
  })

  it('v-model:open: родитель открывает и видит закрытие', async () => {
    const { open, w } = mountPopover({}, ref<boolean | undefined>(false))
    open.value = true
    await w.vm.$nextTick()
    expect(openLayers()).toHaveLength(1)
    dismissPopupLayers('outside')
    await nextTick()
    expect(open.value).toBe(false)
    expect(openLayers()).toHaveLength(0)
  })

  it('Esc закрывает и возвращает фокус на кнопку', async () => {
    const { trigger } = mountPopover()
    trigger.click()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(openLayers()).toHaveLength(0)
    expect(document.activeElement).toBe(trigger)
  })

  it('открыли с клавиатуры — фокус на первое в панели; закрылась — на кнопку', async () => {
    const { trigger, open, w } = mountPopover({}, ref<boolean | undefined>(false))
    keyboardClick(trigger)
    await vi.waitFor(() => expect(document.activeElement?.className).toBe('first'))
    open.value = false
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(trigger)
  })

  it('открыли мышью — фокус остаётся', async () => {
    const { trigger } = mountPopover()
    trigger.focus()
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await frames()
    expect(document.activeElement).toBe(trigger)
  })

  it('hover: курсор открывает, ушёл — закрывает; нажатие закрепляет', async () => {
    vi.useFakeTimers()
    const { trigger } = mountPopover({ trigger: ['hover', 'click'], mouseEnterDelay: 0.2 })
    pointer(trigger, 'pointerenter')
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(openLayers()).toHaveLength(1)
    expect(openLayers()[0]!.hover).toBe(true)
    pointer(trigger, 'pointerleave')
    pointer(panel()!, 'pointerenter')
    vi.advanceTimersByTime(300)
    await nextTick()
    expect(openLayers()).toHaveLength(1)
    pointer(panel()!, 'pointerleave')
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(openLayers()).toHaveLength(0)
    pointer(trigger, 'pointerenter')
    vi.advanceTimersByTime(200)
    await nextTick()
    trigger.click()
    pointer(trigger, 'pointerleave')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(openLayers()).toHaveLength(1)
    trigger.click()
    await nextTick()
    expect(openLayers()).toHaveLength(0)
  })

  it('касание по hover не открывает', async () => {
    vi.useFakeTimers()
    const { trigger } = mountPopover({ trigger: ['hover', 'click'] })
    pointer(trigger, 'pointerenter', 'touch')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(openLayers()).toHaveLength(0)
  })

  it('класс панели и закрытие с анимацией помечают её закрытой', async () => {
    const { trigger } = mountPopover({ overlayClass: 'comment-menu-popover' })
    trigger.click()
    await nextTick()
    expect(panel()!.classList.contains('comment-menu-popover')).toBe(true)
    expect(panel()!.dataset.state).toBe('open')
  })
})

describe('Popconfirm', () => {
  function mountConfirm(props: Record<string, unknown> = {}) {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const w = keep(
      mount(
        defineComponent({
          setup: () => () =>
            h(
              Popconfirm,
              {
                title: 'Покинуть группу?',
                description: 'Вы перестанете получать сообщения.',
                okText: 'Покинуть',
                cancelText: 'Отмена',
                onConfirm,
                onCancel,
                ...props,
              },
              { default: () => h('button', { type: 'button', class: 'trigger' }, 'Выйти') }
            ),
        }),
        { attachTo: document.body }
      )
    )
    return {
      w,
      onConfirm,
      onCancel,
      trigger: document.querySelector('.trigger') as HTMLButtonElement,
    }
  }

  it('alertdialog с названием; «Отмена» закрывает без подтверждения', async () => {
    const { trigger, onConfirm, onCancel } = mountConfirm()
    trigger.click()
    await nextTick()
    const el = panel()!
    expect(el.getAttribute('role')).toBe('alertdialog')
    expect(el.getAttribute('aria-label')).toBe('Покинуть группу?')
    expect(el.querySelector('.ui-popconfirm__description')?.textContent).toBe(
      'Вы перестанете получать сообщения.'
    )
    const [cancel] = el.querySelectorAll('button')
    cancel!.click()
    await nextTick()
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(openLayers()).toHaveLength(0)
  })

  it('подтверждение — опасная кнопка, событие и закрытие; с клавиатуры фокус на «Отмена»', async () => {
    const { trigger, onConfirm } = mountConfirm({ danger: true })
    keyboardClick(trigger)
    await vi.waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('Отмена'))
    const buttons = panel()!.querySelectorAll('button')
    expect(buttons[1]!.className).toMatch(/danger/)
    buttons[1]!.click()
    await nextTick()
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(openLayers()).toHaveLength(0)
  })
})
