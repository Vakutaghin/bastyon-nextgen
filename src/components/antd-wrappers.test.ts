// Обёртки antd в src/components обязаны доносить объявленные пропсы и слоты
// до antd (аудит X8: Empty без иллюстрации). Поля (K6, V13) и окна (S63)
// уже свои — их тесты рядом с ними.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import Empty from './empty/empty.vue'
import Select from './select/select.vue'
import { CloseOutlined } from './icons'

const mounted: Array<{ unmount: () => void }> = []
const keep = <T extends { unmount: () => void }>(w: T): T => (mounted.push(w), w)
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('Empty', () => {
  it('Empty: подпись из пропа и иконка в круге, как UEmpty', () => {
    const w = keep(mount(Empty, { props: { description: 'Пусто' } }))
    expect(w.text()).toBe('Пусто')
    expect(w.find('.anticon svg').exists()).toBe(true)
  })

  it('Empty: заголовок и своя иконка', () => {
    const w = keep(
      mount(Empty, {
        props: { title: 'Нет видео', description: 'Загрузите первое', icon: CloseOutlined },
      })
    )
    expect(w.text()).toContain('Нет видео')
    expect(w.text()).toContain('Загрузите первое')
    expect(w.find('.anticon').exists()).toBe(true)
  })
})

describe('Select (обёртка)', () => {
  const options = [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
  ]

  it('значение показывает подпись, id уходит в поле для <label for>', () => {
    const w = keep(mount(Select, { props: { options, value: 'en' }, attrs: { id: 'lang' } }))
    expect(w.find('.ant-select-selection-item').text()).toBe('English')
    expect(w.find('input#lang').exists()).toBe(true)
    // По умолчанию большой — 36px, как поля ввода в формах.
    expect(w.find('.ant-select').classes()).toContain('ant-select-lg')
  })

  it('выбор пункта шлёт update:value и change, список — со своим классом и галочкой', async () => {
    const onUpdate = vi.fn()
    const onChange = vi.fn()
    keep(
      mount(Select, {
        props: { options, value: 'ru' },
        attrs: { 'onUpdate:value': onUpdate, onChange, open: true },
        attachTo: document.body,
      })
    )
    await nextTick()
    const popup = document.querySelector('.ui-select-dropdown')
    expect(popup).not.toBeNull()
    const selected = popup?.querySelector('.ant-select-item-option-selected')
    expect(selected?.textContent).toContain('Русский')
    expect(selected?.querySelector('.ant-select-item-option-state .ui-icon')).not.toBeNull()

    const english = [...(popup?.querySelectorAll('.ant-select-item-option') ?? [])].find((el) =>
      el.textContent?.includes('English')
    ) as HTMLElement | undefined
    english?.click()
    await nextTick()
    expect(onUpdate).toHaveBeenCalledWith('en')
    expect(onChange.mock.calls[0]?.[0]).toBe('en')
  })

  it('size="middle" — 32px, disabled доходит до antd', () => {
    const w = keep(mount(Select, { props: { options, size: 'middle', disabled: true } }))
    const root = w.find('.ant-select')
    expect(root.classes()).not.toContain('ant-select-lg')
    expect(root.classes()).toContain('ant-select-disabled')
  })
})
