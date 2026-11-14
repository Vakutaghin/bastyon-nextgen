// Своё поле вместо antd Input: пропсы и атрибуты доходят до <input> (V13 —
// мнемоника не должна идти открытым текстом), значение управляемое, Enter и
// крестик — как у antd.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'

import Input from './input.vue'
import { countLabel, isEnterKey } from './input'
import { UI } from '@/components/testing/ui-selectors'

const mounted: Array<{ unmount: () => void }> = []
const keep = <T extends { unmount: () => void }>(w: T): T => (mounted.push(w), w)
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

const control = (w: ReturnType<typeof mount>) => w.find('input').element as HTMLInputElement

describe('Input', () => {
  it('type/placeholder/disabled/readonly доходят до input и меняются (V13)', async () => {
    const w = keep(
      mount(Input, { props: { type: 'password', placeholder: 'seed', disabled: true, value: 'x' } })
    )
    const input = w.find('input')
    expect(input.attributes('type')).toBe('password')
    expect(input.attributes('placeholder')).toBe('seed')
    expect(input.attributes('disabled')).toBeDefined()
    expect(w.attributes('data-disabled')).toBeDefined()
    await w.setProps({ type: 'text', disabled: false, readonly: true })
    expect(w.find('input').attributes('type')).toBe('text')
    expect(w.find('input').attributes('disabled')).toBeUndefined()
    expect(w.find('input').attributes('readonly')).toBeDefined()
  })

  it('class и style — на корень, остальные атрибуты — на сам input', () => {
    const w = keep(
      mount(Input, {
        attrs: {
          class: 'my',
          autocomplete: 'off',
          'data-testid': 'q',
          'aria-label': 'Поиск',
          id: 'f',
        },
      })
    )
    expect(w.classes()).toContain('my')
    expect(w.classes()).toContain('ui-input')
    const input = w.find('input')
    expect(input.attributes('autocomplete')).toBe('off')
    expect(input.attributes('data-testid')).toBe('q')
    expect(input.attributes('aria-label')).toBe('Поиск')
    expect(input.attributes('id')).toBe('f')
    expect(w.attributes('autocomplete')).toBeUndefined()
    expect(w.attributes('data-testid')).toBeUndefined()
    expect(input.classes()).not.toContain('my')
  })

  it('набор шлёт update:value; отвергнутое родителем значение в поле не остаётся', async () => {
    const onUpdate = vi.fn()
    // Родитель value не меняет: поле должно вернуться к 'abc'.
    const w = keep(mount(Input, { props: { value: 'abc', 'onUpdate:value': onUpdate } }))
    const el = control(w)
    el.value = 'abc!'
    await w.find('input').trigger('input')
    expect(onUpdate).toHaveBeenCalledWith('abc!')
    await nextTick()
    expect(el.value).toBe('abc')
  })

  it('без value поле помнит набранное само', async () => {
    const w = keep(mount(Input, { props: { allowClear: true } }))
    await w.find('input').setValue('hello')
    await nextTick()
    expect(control(w).value).toBe('hello')
    expect(w.find(UI.inputClear).attributes('data-hidden')).toBeUndefined()
  })

  it('@input потребителя видит событие после update:value и может поправить значение', async () => {
    const order: string[] = []
    const w = keep(
      mount(Input, {
        props: {
          value: '',
          'onUpdate:value': (v: string) => {
            order.push(`update:${v}`)
            void w.setProps({ value: v })
          },
        },
        attrs: {
          onInput: (e: Event) => {
            const v = (e.target as HTMLInputElement).value.replace(/\s+/g, '_')
            order.push(`input:${v}`)
            void w.setProps({ value: v })
          },
        },
      })
    )
    const el = control(w)
    el.value = 'a b'
    await w.find('input').trigger('input')
    await nextTick()
    await nextTick()
    expect(order).toEqual(['update:a b', 'input:a_b'])
    expect(el.value).toBe('a_b')
  })

  it('Enter шлёт pressEnter, а подтверждение слова в IME — нет', async () => {
    const onPressEnter = vi.fn()
    const w = keep(mount(Input, { props: { onPressEnter } }))
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(onPressEnter).toHaveBeenCalledTimes(1)
    await w.find('input').trigger('keydown', { key: 'Enter', isComposing: true })
    await w.find('input').trigger('keydown', { key: 'Enter', keyCode: 229 })
    await w.find('input').trigger('keydown', { key: 'a' })
    expect(onPressEnter).toHaveBeenCalledTimes(1)
  })

  it('крестик: скрыт у пустого поля, стирает поле, шлёт clear и возвращает фокус', async () => {
    const onUpdate = vi.fn()
    const onClear = vi.fn()
    const w = keep(
      mount(Input, {
        props: { value: '', allowClear: true, 'onUpdate:value': onUpdate, onClear },
        attachTo: document.body,
      })
    )
    const btn = w.find(UI.inputClear)
    expect(btn.attributes('data-hidden')).toBeDefined()
    expect(btn.attributes('tabindex')).toBe('-1')
    expect(btn.attributes('type')).toBe('button')
    expect(btn.attributes('aria-label')).toBeTruthy()

    await w.setProps({ value: 'text' })
    expect(w.find(UI.inputClear).attributes('data-hidden')).toBeUndefined()
    await w.find(UI.inputClear).trigger('click')
    expect(onUpdate).toHaveBeenCalledWith('')
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(control(w))
  })

  it('у неактивного и readonly поля крестика нет', () => {
    const a = keep(mount(Input, { props: { value: 'x', allowClear: true, disabled: true } }))
    const b = keep(mount(Input, { props: { value: 'x', allowClear: true, readonly: true } }))
    expect(a.find(UI.inputClear).exists()).toBe(false)
    expect(b.find(UI.inputClear).exists()).toBe(false)
  })

  it('счётчик, статус ошибки и maxlength', () => {
    const w = keep(
      mount(Input, { props: { value: 'Ролик', showCount: true, maxlength: 120, status: 'error' } })
    )
    expect(w.find('.ui-input__count').text()).toBe('5 / 120')
    expect(w.attributes('data-status')).toBe('error')
    expect(w.find('input').attributes('aria-invalid')).toBe('true')
    expect(w.find('input').attributes('maxlength')).toBe('120')
  })

  it('слот #prefix — слева в рамке поля', () => {
    const w = keep(mount(Input, { slots: { prefix: () => h('i', { class: 'icon' }) } }))
    expect(w.find('.ui-input__prefix .icon').exists()).toBe(true)
    expect(w.element.firstElementChild?.classList.contains('ui-input__prefix')).toBe(true)
  })

  it('autofocus ставит фокус после монтирования; focus() доступен через ref', async () => {
    const w = keep(mount(Input, { props: { autofocus: true }, attachTo: document.body }))
    await nextTick()
    expect(document.activeElement).toBe(control(w))
    expect(w.find('input').attributes('autofocus')).toBeDefined()

    const other = keep(mount(Input, { attachTo: document.body }))
    ;(other.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(control(other))
  })
})

describe('помощники поля', () => {
  it('countLabel: с пределом и без', () => {
    expect(countLabel('abc', 10)).toBe('3 / 10')
    expect(countLabel('abc')).toBe('3')
  })

  it('isEnterKey отсекает IME', () => {
    expect(isEnterKey(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(true)
    expect(isEnterKey(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }))).toBe(
      false
    )
    expect(isEnterKey(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(false)
  })
})
