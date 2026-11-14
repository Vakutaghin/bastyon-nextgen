// Поиск вместо antd Input.Search: Enter и кнопка ищут (K6 — Enter в поиске
// был мёртв), крестик ищет пустую строку, пока идёт поиск — повторный не
// запускается.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import InputSearch from './input-search.vue'
import { UI } from '@/components/testing/ui-selectors'

const mounted: Array<{ unmount: () => void }> = []
const keep = <T extends { unmount: () => void }>(w: T): T => (mounted.push(w), w)
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

const BUTTON = '.ui-input-search__button'

describe('InputSearch', () => {
  it('@search по Enter и по кнопке; v-model:value управляет полем (K6)', async () => {
    const onSearch = vi.fn()
    const w = keep(
      mount(InputSearch, {
        props: {
          value: 'abc',
          placeholder: 'find',
          'onUpdate:value': (v: string) => w.setProps({ value: v }),
          onSearch,
        },
      })
    )
    const input = w.find('input')
    expect(input.attributes('placeholder')).toBe('find')
    expect((input.element as HTMLInputElement).value).toBe('abc')
    await input.trigger('keydown', { key: 'Enter' })
    expect(onSearch).toHaveBeenLastCalledWith('abc')
    await input.setValue('new')
    await nextTick()
    expect((w.find('input').element as HTMLInputElement).value).toBe('new')
    await w.find(BUTTON).trigger('click')
    expect(onSearch).toHaveBeenLastCalledWith('new')
    expect(onSearch).toHaveBeenCalledTimes(2)
  })

  it('крестик шлёт search с пустой строкой и clear', async () => {
    const onSearch = vi.fn()
    const onClear = vi.fn()
    const w = keep(
      mount(InputSearch, {
        props: {
          value: 'q',
          allowClear: true,
          'onUpdate:value': (v: string) => w.setProps({ value: v }),
          onSearch,
          onClear,
        },
      })
    )
    await w.find(UI.inputClear).trigger('click')
    expect(onSearch).toHaveBeenCalledWith('')
    expect(onClear).toHaveBeenCalledTimes(1)
    expect((w.find('input').element as HTMLInputElement).value).toBe('')
  })

  it('пока идёт поиск, Enter и кнопка не ищут; в кнопке крутится значок', async () => {
    const onSearch = vi.fn()
    const w = keep(mount(InputSearch, { props: { value: 'q', loading: true, onSearch } }))
    await w.find('input').trigger('keydown', { key: 'Enter' })
    await w.find(BUTTON).trigger('click')
    expect(onSearch).not.toHaveBeenCalled()
    expect(w.find(BUTTON).attributes('aria-busy')).toBe('true')
    expect(w.find(`${BUTTON} .ui-icon-spin`).exists()).toBe(true)
  })

  it('неактивный поиск не ищет', async () => {
    const onSearch = vi.fn()
    const w = keep(mount(InputSearch, { props: { value: 'q', disabled: true, onSearch } }))
    expect(w.find(BUTTON).attributes('disabled')).toBeDefined()
    expect(w.find('input').attributes('disabled')).toBeDefined()
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('на кнопке — лупа и название словом; у поля — подсказка как название', () => {
    const w = keep(mount(InputSearch, { props: { value: '', placeholder: 'Поиск…' } }))
    expect(w.find(`${BUTTON} svg`).classes()).toContain('lucide-search')
    expect(w.find(`${BUTTON} .visually-hidden`).text()).not.toBe('')
    expect(w.find('input').attributes('aria-label')).toBe('Поиск…')
  })

  it('aria-label потребителя важнее подсказки; data-testid — на input, class — на корень', () => {
    const w = keep(
      mount(InputSearch, {
        props: { placeholder: 'Поиск…' },
        attrs: { 'aria-label': 'Найти видео', 'data-testid': 'video-search', class: 'mine' },
      })
    )
    const input = w.find('input')
    expect(input.attributes('aria-label')).toBe('Найти видео')
    expect(input.attributes('data-testid')).toBe('video-search')
    expect(w.classes()).toContain('mine')
    expect(w.classes()).toContain('ui-input-search')
  })

  it('нажатие на кнопку не уводит фокус из поля', async () => {
    const w = keep(mount(InputSearch, { props: { value: 'q' }, attachTo: document.body }))
    const input = w.find('input').element as HTMLInputElement
    input.focus()
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    w.find(BUTTON).element.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)

    input.blur()
    const idle = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    w.find(BUTTON).element.dispatchEvent(idle)
    expect(idle.defaultPrevented).toBe(false)
  })
})
