// Своё многострочное поле вместо antd Input.TextArea: высота по тексту в
// пределах строк, счётчик под полем, атрибуты — на textarea.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import TextArea from './textarea.vue'
import { autoSizeRows, measureArea } from './textarea'

const mounted: Array<{ unmount: () => void }> = []
const keep = <T extends { unmount: () => void }>(w: T): T => (mounted.push(w), w)
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

// happy-dom не раскладывает текст: высота содержимого двойника — по числу
// строк, 22px на строку плюс поля 4 + 4 (как у настоящего поля).
const LINE = 22
const PAD = 8
const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      const text = 'value' in this ? this.value : ''
      return (text ? text.split('\n').length : 1) * LINE + PAD
    },
  })
})
afterAll(() => {
  if (original) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', original)
})

function styledArea(value: string, placeholder = ''): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  el.style.cssText =
    'box-sizing:border-box;line-height:22px;font-size:14px;padding:4px 11px;border:1px solid'
  el.value = value
  el.placeholder = placeholder
  document.body.appendChild(el)
  return el
}

describe('measureArea', () => {
  it('короткий текст — не ниже minRows', () => {
    const el = styledArea('одна строка')
    expect(measureArea(el, { minRows: 3, maxRows: 5 })).toEqual({
      height: 3 * LINE + PAD + 2,
      scroll: false,
    })
    el.remove()
  })

  it('текст между пределами — по числу строк', () => {
    const el = styledArea('1\n2\n3\n4')
    expect(measureArea(el, { minRows: 3, maxRows: 5 })).toEqual({
      height: 4 * LINE + PAD + 2,
      scroll: false,
    })
    el.remove()
  })

  it('длиннее maxRows — высота на пределе и прокрутка', () => {
    const el = styledArea('1\n2\n3\n4\n5\n6\n7\n8')
    expect(measureArea(el, { minRows: 3, maxRows: 5 })).toEqual({
      height: 5 * LINE + PAD + 2,
      scroll: true,
    })
    el.remove()
  })

  it('пустое поле меряется по подсказке', () => {
    const el = styledArea('', 'строка\nещё строка')
    expect(measureArea(el, {}).height).toBe(2 * LINE + PAD + 2)
    el.remove()
  })

  it('autoSizeRows: false — без подгонки, true — без пределов', () => {
    expect(autoSizeRows(false)).toBeNull()
    expect(autoSizeRows(undefined)).toBeNull()
    expect(autoSizeRows(true)).toEqual({})
    expect(autoSizeRows({ minRows: 2 })).toEqual({ minRows: 2 })
  })
})

describe('TextArea', () => {
  it('атрибуты — на textarea, class — на корень; набор шлёт update:value', async () => {
    const onUpdate = vi.fn()
    const w = keep(
      mount(TextArea, {
        props: { value: '', placeholder: 'Описание', 'onUpdate:value': onUpdate },
        attrs: { id: 'desc', autocomplete: 'off', spellcheck: 'false', class: 'mine' },
      })
    )
    const area = w.find('textarea')
    expect(area.attributes('id')).toBe('desc')
    expect(area.attributes('autocomplete')).toBe('off')
    expect(area.attributes('placeholder')).toBe('Описание')
    expect(w.classes()).toContain('mine')
    expect(w.attributes('id')).toBeUndefined()
    await area.setValue('текст')
    expect(onUpdate).toHaveBeenCalledWith('текст')
  })

  it('autoSize задаёт высоту и пересчитывает её при смене текста', async () => {
    const w = keep(
      mount(TextArea, {
        props: { value: 'a', autoSize: { minRows: 3, maxRows: 5 } },
        attachTo: document.body,
      })
    )
    const el = w.find('textarea').element as HTMLTextAreaElement
    el.style.cssText = 'box-sizing:border-box;line-height:22px;padding:4px 11px;border:1px solid'
    await w.setProps({ value: '1\n2\n3\n4' })
    await nextTick()
    expect(el.style.height).toBe(`${4 * LINE + PAD + 2}px`)
    expect(el.style.overflowY).toBe('hidden')
    await w.setProps({ value: '1\n2\n3\n4\n5\n6\n7' })
    await nextTick()
    expect(el.style.height).toBe(`${5 * LINE + PAD + 2}px`)
    expect(el.style.overflowY).toBe('auto')
    expect(w.attributes('data-auto-size')).toBeDefined()
  })

  it('без autoSize высоту не трогает и тянуть за угол можно', () => {
    const w = keep(mount(TextArea, { props: { value: 'a' } }))
    expect((w.find('textarea').element as HTMLTextAreaElement).style.height).toBe('')
    expect(w.attributes('data-auto-size')).toBeUndefined()
  })

  it('счётчик под полем, статус ошибки, maxlength, disabled', () => {
    const w = keep(
      mount(TextArea, {
        props: { value: 'abc', showCount: true, maxlength: 500, status: 'error', disabled: true },
      })
    )
    expect(w.find('.ui-textarea__count').text()).toBe('3 / 500')
    expect(w.attributes('data-status')).toBe('error')
    expect(w.attributes('data-disabled')).toBeDefined()
    const area = w.find('textarea')
    expect(area.attributes('aria-invalid')).toBe('true')
    expect(area.attributes('maxlength')).toBe('500')
    expect(area.attributes('disabled')).toBeDefined()
  })

  it('focus() через ref — как у antd, для окна восстановления замка', () => {
    const w = keep(mount(TextArea, { attachTo: document.body }))
    ;(w.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(w.find('textarea').element)
  })
})
