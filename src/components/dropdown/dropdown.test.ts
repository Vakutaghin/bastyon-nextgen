// Dropdown + Menu: кнопка без обёртки с aria и классом, меню по WAI-ARIA
// (стрелки, Home / End, Enter), выбор пункта закрывает панель, недоступный
// пункт не выбирается, черта, свои панели в слое над окном, из которого открыли.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { Z_INDEX } from '@/styles/design-tokens'
import { openLayers, resetLayersForTests } from '@/components/ui-core/layer-stack'
import { UI } from '@/components/testing/ui-selectors'

vi.mock('@floating-ui/dom', () => ({
  autoUpdate: () => () => {},
  computePosition: async () => ({ x: 10, y: 20, placement: 'bottom-start' }),
  flip: () => ({}),
  offset: () => ({}),
  shift: () => ({}),
  size: () => ({}),
}))

import Dropdown from './dropdown.vue'
import Menu from '@/components/menu'
import type { MenuItem } from '@/components/menu'

const ITEMS: MenuItem[] = [
  { key: 'edit', label: 'Изменить', icon: () => h('i', { class: 'icon-edit' }) },
  { key: 'left', label: 'Осталось правок: 3', disabled: true },
  { type: 'divider' },
  { key: 'delete', label: 'Удалить', danger: true },
]

const mounted: VueWrapper[] = []

function mountMenu(onClick = vi.fn(), open = ref<boolean | undefined>()) {
  const w = mount(
    defineComponent({
      setup: () => () =>
        h('div', { class: 'row' }, [
          h(
            Dropdown,
            {
              open: open.value,
              'onUpdate:open': (v: boolean) => (open.value = v),
              placement: 'bottomRight',
            },
            {
              default: () => h('button', { type: 'button', class: 'more' }, '⋯'),
              overlay: () => h(Menu, { items: ITEMS, onClick }),
            }
          ),
        ]),
    }),
    { attachTo: document.body }
  )
  mounted.push(w)
  return { w, onClick, open, trigger: w.element.querySelector('button') as HTMLButtonElement }
}

const items = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(UI.menuItem)]

function key(el: Element, name: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
}

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  resetLayersForTests()
  document.body.innerHTML = ''
})

describe('Dropdown', () => {
  it('кнопка — сам элемент из слота: класс, aria; панель — в слое выпадашек', async () => {
    const { trigger } = mountMenu()
    expect(trigger.parentElement?.className).toBe('row')
    expect(trigger.classList.contains('ui-dropdown-trigger')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    trigger.click()
    await nextTick()
    expect(trigger.classList.contains('ui-dropdown-open')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const panel = document.querySelector('.ui-dropdown')!
    expect(panel.closest('#ui-layers')).not.toBeNull()
    expect(openLayers().map((l) => [l.kind, l.zIndex])).toEqual([['dropdown', Z_INDEX.DROPDOWN]])
  })

  it('меню: role menu / menuitem / separator, значок, опасный и недоступный пункт', async () => {
    const { trigger } = mountMenu()
    trigger.click()
    await nextTick()
    expect(document.querySelector('.ui-menu')?.getAttribute('role')).toBe('menu')
    const [edit, left, del] = items()
    expect(edit!.getAttribute('role')).toBe('menuitem')
    expect(edit!.querySelector(`${UI.menuItemIcon} .icon-edit`)).not.toBeNull()
    expect(edit!.querySelector(UI.menuItemLabel)?.textContent).toBe('Изменить')
    expect(left!.getAttribute('aria-disabled')).toBe('true')
    expect(del!.hasAttribute('data-danger')).toBe(true)
    expect(document.querySelector('.ui-menu__divider')?.getAttribute('role')).toBe('separator')
  })

  it('выбор пункта шлёт click({ key }) и закрывает панель; недоступный — нет', async () => {
    const { trigger, onClick, open } = mountMenu()
    trigger.click()
    await nextTick()
    items()[1]!.click()
    await nextTick()
    expect(onClick).not.toHaveBeenCalled()
    expect(openLayers()).toHaveLength(1)
    items()[2]!.click()
    await nextTick()
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ key: 'delete' }))
    expect(open.value).toBe(false)
    expect(openLayers()).toHaveLength(0)
  })

  it('закрыли пунктом и сразу нажали кнопку — открывается, а не закрывается', async () => {
    const { trigger, open } = mountMenu(vi.fn(), ref<boolean | undefined>(false))
    trigger.click()
    await nextTick()
    items()[0]!.click()
    trigger.click()
    await nextTick()
    expect(open.value).toBe(true)
    expect(openLayers()).toHaveLength(1)
  })

  it('родитель держит open: нажатие сообщает openChange, но панель не открывает', async () => {
    const onOpenChange = vi.fn()
    const w = mount(
      defineComponent({
        setup: () => () =>
          h(
            Dropdown,
            { open: false, onOpenChange },
            {
              default: () => h('button', { type: 'button', class: 'bell' }, '🔔'),
              overlay: () => h('div', 'Уведомления'),
            }
          ),
      }),
      { attachTo: document.body }
    )
    mounted.push(w)
    const bell = document.querySelector<HTMLButtonElement>('.bell')!
    bell.click()
    await nextTick()
    await nextTick()
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(openLayers()).toHaveLength(0)
    bell.click()
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
  })

  it('клавиатура: фокус на первый пункт, стрелки по кругу мимо недоступного, Enter выбирает', async () => {
    const { trigger, onClick } = mountMenu()
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await vi.waitFor(() => expect(document.activeElement).toBe(items()[0]))
    const menu = document.querySelector('.ui-menu')!
    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(items()[2])
    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(items()[0])
    key(document.activeElement!, 'ArrowUp')
    expect(document.activeElement).toBe(items()[2])
    key(document.activeElement!, 'Home')
    expect(document.activeElement).toBe(items()[0])
    key(document.activeElement!, 'End')
    expect(document.activeElement).toBe(items()[2])
    expect(menu.contains(document.activeElement)).toBe(true)
    key(document.activeElement!, 'Enter')
    await nextTick()
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ key: 'delete' }))
    expect(document.activeElement).toBe(trigger)
  })

  it('Tab в меню закрывает его и возвращает фокус на кнопку', async () => {
    const { trigger } = mountMenu()
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await vi.waitFor(() => expect(document.activeElement).toBe(items()[0]))
    key(document.activeElement!, 'Tab')
    await nextTick()
    expect(openLayers()).toHaveLength(0)
    expect(document.activeElement).toBe(trigger)
  })

  it('из слоя на 2500 (мессенджер во весь экран) панель встаёт выше', async () => {
    const { w, trigger } = mountMenu()
    const shell = document.createElement('div')
    shell.style.position = 'fixed'
    shell.style.zIndex = '2500'
    document.body.append(shell)
    shell.append(w.element)
    trigger.click()
    await nextTick()
    await nextTick()
    const panel = document.querySelector<HTMLElement>('.ui-dropdown')!
    expect(Number(panel.style.zIndex)).toBe(2501)
  })
})
