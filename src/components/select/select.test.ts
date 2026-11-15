// Поле выбора (select-only combobox): подпись в поле, id для <label for>,
// список по нажатию и с клавиатуры, выбор шлёт update:value и change, выбор
// нескольких не закрывает список, поиск по первым буквам, Esc гасится полем,
// список — в слое над окном, из которого открыли.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
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

import Select from './select.vue'
import type { SelectOption } from './types'

const OPTIONS: SelectOption[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español', disabled: true },
  { value: 'de', label: 'Deutsch' },
]

const mounted: VueWrapper[] = []

function mountSelect(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  const w = mount(Select, {
    props: { options: OPTIONS, value: 'en', ...props },
    attrs,
    attachTo: document.body,
  })
  mounted.push(w)
  const trigger = w.find<HTMLButtonElement>('.ui-select__trigger').element
  return { w, trigger }
}

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  resetLayersForTests()
  document.body.innerHTML = ''
})

function key(el: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  el.dispatchEvent(event)
  return event
}

function press(el: Element): void {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
}

const options = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(UI.selectOption)]
const activeText = (trigger: HTMLElement): string | undefined => {
  const id = trigger.getAttribute('aria-activedescendant')
  return id ? document.getElementById(id)?.textContent?.trim() : undefined
}

describe('Select', () => {
  it('подпись выбранного в поле; id, aria и data-testid — на поле, class — на корне', () => {
    const { w, trigger } = mountSelect({}, { id: 'lang', 'data-testid': 'lang', class: 'extra' })
    expect(w.find('.ui-select__value').text()).toBe('English')
    expect(trigger.id).toBe('lang')
    expect(trigger.dataset.testid).toBe('lang')
    expect(trigger.getAttribute('role')).toBe('combobox')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(w.element.classList.contains('extra')).toBe(true)
    // По умолчанию большой — 36px, как поля ввода в формах.
    expect(w.element.getAttribute('data-size')).toBe('large')
  })

  it('пусто — подсказка; значение не из списка — как есть', async () => {
    const { w } = mountSelect({ value: undefined, placeholder: 'Выберите файл' })
    expect(w.find('.ui-select__placeholder').text()).toBe('Выберите файл')
    await w.setProps({ value: 'zz' })
    expect(w.find('.ui-select__value').text()).toBe('zz')
    // Пустая строка — тоже значение (тег «все темы»).
    await w.setProps({ value: '', options: [{ value: '', label: 'Все темы' }] })
    expect(w.find('.ui-select__value').text()).toBe('Все темы')
  })

  it('нажатие открывает список в слое, выбор шлёт update:value и change и закрывает', async () => {
    const onUpdate = vi.fn()
    const onChange = vi.fn()
    const { trigger } = mountSelect({}, { 'onUpdate:value': onUpdate, onChange })
    press(trigger)
    await nextTick()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const listbox = document.querySelector('[role="listbox"]')!
    expect(trigger.getAttribute('aria-controls')).toBe(listbox.id)
    expect(listbox.closest('#ui-layers')).not.toBeNull()
    expect(openLayers().map((l) => [l.kind, l.zIndex])).toEqual([['select', Z_INDEX.DROPDOWN]])
    // Выбранный — с галочкой и подсвечен.
    const english = options()[1]!
    expect(english.getAttribute('aria-selected')).toBe('true')
    expect(english.querySelector('.ui-select__check')).not.toBeNull()
    expect(activeText(trigger)).toBe('English')

    options()[3]!.click()
    await nextTick()
    expect(onUpdate).toHaveBeenCalledWith('de')
    expect(onChange.mock.calls[0]?.slice(0, 1)).toEqual(['de'])
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    expect(openLayers()).toHaveLength(0)
  })

  it('тот же пункт и недоступный — без событий', async () => {
    const onChange = vi.fn()
    const { trigger } = mountSelect({}, { onChange })
    press(trigger)
    await nextTick()
    options()[2]!.click()
    await nextTick()
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
    options()[1]!.click()
    await nextTick()
    expect(onChange).not.toHaveBeenCalled()
    expect(document.querySelector('[role="listbox"]')).toBeNull()
  })

  it('клавиатура: ↓ открывает, стрелки по кругу мимо недоступных, Enter выбирает', async () => {
    const onUpdate = vi.fn()
    const { trigger } = mountSelect({}, { 'onUpdate:value': onUpdate })
    expect(key(trigger, 'ArrowDown').defaultPrevented).toBe(true)
    await nextTick()
    expect(activeText(trigger)).toBe('English')
    key(trigger, 'ArrowDown')
    await nextTick()
    expect(activeText(trigger)).toBe('Deutsch')
    key(trigger, 'ArrowDown')
    await nextTick()
    expect(activeText(trigger)).toBe('Русский')
    key(trigger, 'ArrowUp')
    await nextTick()
    expect(activeText(trigger)).toBe('Deutsch')
    key(trigger, 'Home')
    await nextTick()
    expect(activeText(trigger)).toBe('Русский')
    key(trigger, 'End')
    await nextTick()
    expect(activeText(trigger)).toBe('Deutsch')
    key(trigger, 'Enter')
    await nextTick()
    expect(onUpdate).toHaveBeenCalledWith('de')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('Esc закрывает без выбора и гасится — окно вокруг его не получает', async () => {
    const onUpdate = vi.fn()
    const { trigger } = mountSelect({}, { 'onUpdate:value': onUpdate })
    key(trigger, 'Enter')
    await nextTick()
    key(trigger, 'ArrowDown')
    const esc = key(trigger, 'Escape')
    await nextTick()
    expect(esc.defaultPrevented).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(onUpdate).not.toHaveBeenCalled()
    // Закрытое поле Esc не трогает.
    expect(key(trigger, 'Escape').defaultPrevented).toBe(false)
  })

  it('первые буквы: закрытое открывается на найденном, повтор буквы — по кругу', async () => {
    vi.useFakeTimers()
    try {
      const { trigger } = mountSelect({
        options: [
          { value: 'a', label: 'Deutsch' },
          { value: 'b', label: 'English' },
          { value: 'c', label: 'Dansk' },
        ],
        value: undefined,
      })
      key(trigger, 'd')
      await nextTick()
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(activeText(trigger)).toBe('Deutsch')
      key(trigger, 'd')
      await nextTick()
      expect(activeText(trigger)).toBe('Dansk')
      vi.advanceTimersByTime(600)
      key(trigger, 'e')
      key(trigger, 'n')
      await nextTick()
      expect(activeText(trigger)).toBe('English')
      // Пробел посреди набора — буква, а не выбор.
      expect(key(trigger, ' ').defaultPrevented).toBe(true)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('несколько: пункт отмечается и снимается, список остаётся; в поле — formatValue', async () => {
    const onUpdate = vi.fn()
    const { w, trigger } = mountSelect(
      {
        mode: 'multiple',
        value: ['ru', 'en'],
        formatValue: (values: string[]) => values.map((v) => v.toUpperCase()).join(', '),
      },
      { 'onUpdate:value': onUpdate }
    )
    expect(w.find('.ui-select__value').text()).toBe('RU, EN')
    press(trigger)
    await nextTick()
    expect(document.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe(
      'true'
    )
    options()[0]!.click()
    expect(onUpdate).toHaveBeenLastCalledWith(['en'])
    options()[3]!.click()
    expect(onUpdate).toHaveBeenLastCalledWith(['ru', 'en', 'de'])
    await nextTick()
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
  })

  it('по умолчанию в поле — подписи выбранных через запятую', () => {
    const { w } = mountSelect({ mode: 'multiple', value: ['de', 'ru'] })
    expect(w.find('.ui-select__value').text()).toBe('Deutsch, Русский')
  })

  it('выключенное: data-disabled, не открывается; выключили открытое — закрылось', async () => {
    const { w, trigger } = mountSelect({ disabled: true, size: 'middle' })
    expect(w.element.matches(UI.selectDisabled)).toBe(true)
    expect(w.element.getAttribute('data-size')).toBe('middle')
    expect(trigger.disabled).toBe(true)
    press(trigger)
    key(trigger, 'ArrowDown')
    await nextTick()
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    await w.setProps({ disabled: false })
    press(trigger)
    await nextTick()
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
    await w.setProps({ disabled: true })
    expect(document.querySelector('[role="listbox"]')).toBeNull()
  })

  it('пустой список — notFoundContent или «Нет данных»', async () => {
    const { w, trigger } = mountSelect({ options: [], value: undefined })
    press(trigger)
    await nextTick()
    expect(document.querySelector('.ui-select__empty')?.textContent?.trim()).toBeTruthy()
    await w.setProps({ notFoundContent: 'Других файлов нет' })
    expect(document.querySelector('.ui-select__empty')?.textContent?.trim()).toBe(
      'Других файлов нет'
    )
  })

  it('у списка имя из <label for> или aria-label поля', async () => {
    const label = document.createElement('label')
    label.htmlFor = 'feed-lang'
    label.textContent = 'Язык ленты'
    document.body.append(label)
    const { trigger } = mountSelect({}, { id: 'feed-lang' })
    press(trigger)
    await nextTick()
    expect(document.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe(
      'Язык ленты'
    )
  })

  it('нажатие по подписи (щелчок без mousedown) только фокусирует', async () => {
    const { trigger } = mountSelect()
    trigger.click()
    await nextTick()
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('список из окна — в слое над ним', async () => {
    const shell = document.createElement('div')
    shell.style.position = 'fixed'
    shell.style.zIndex = '2700'
    document.body.append(shell)
    const w = mount(Select, { props: { options: OPTIONS, value: 'en' }, attachTo: shell })
    mounted.push(w)
    press(w.find('.ui-select__trigger').element)
    await nextTick()
    await nextTick()
    const panel = document.querySelector<HTMLElement>('.ui-select-panel')!
    expect(Number(panel.style.zIndex)).toBe(2701)
  })
})
