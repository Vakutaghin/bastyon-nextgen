// Своя кнопка вместо antd Button: те же пропсы (type, size, danger, block,
// htmlType, loading, disabled), состояние — классами bastyon-button-* и
// атрибутами data-size / data-block, без лишних атрибутов в DOM. Нажатие,
// title, aria-label и data-testid доходят до <button>.

import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import Button from './index'

describe('Button', () => {
  it('по умолчанию — обычная кнопка type="button" среднего размера', () => {
    const w = mount(Button, { slots: { default: 'Текст' } })
    const el = w.get('button').element
    expect(el.getAttribute('type')).toBe('button')
    expect(el.dataset.size).toBe('middle')
    expect(el.hasAttribute('data-block')).toBe(false)
    expect(el.classList).toContain('bastyon-button-secondary')
    expect(el.textContent?.trim()).toBe('Текст')
  })

  it('пропсы размера и вида не попадают в DOM атрибутами', () => {
    const w = mount(Button, { props: { size: 'small', block: true, htmlType: 'submit' } })
    const el = w.get('button').element
    expect(el.getAttribute('type')).toBe('submit')
    expect(el.dataset.size).toBe('small')
    expect(el.hasAttribute('data-block')).toBe(true)
    for (const name of ['size', 'block', 'htmltype', 'html-type']) {
      expect(el.hasAttribute(name)).toBe(false)
    }
  })

  it('виды antd: default → secondary, primary + danger, danger', () => {
    const cls = (props: Record<string, unknown>): string[] => [
      ...mount(Button, { props }).get('button').element.classList,
    ]
    expect(cls({ type: 'default' })).toContain('bastyon-button-secondary')
    expect(cls({ type: 'primary', danger: true })).toEqual(
      expect.arrayContaining(['bastyon-button-primary', 'bastyon-button-danger'])
    )
    expect(cls({ danger: true })).toEqual(
      expect.arrayContaining(['bastyon-button-secondary', 'bastyon-button-danger'])
    )
    expect(cls({ type: 'link' })).toContain('bastyon-button-link')
  })

  it('нажатие и атрибуты родителя доходят до <button>', async () => {
    const onClick = vi.fn()
    const w = mount(Button, {
      attrs: { onClick, title: 'Подсказка', 'aria-label': 'Метка', 'data-testid': 'btn' },
    })
    const el = w.get('[data-testid="btn"]')
    expect(el.attributes('title')).toBe('Подсказка')
    expect(el.attributes('aria-label')).toBe('Метка')
    await el.trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disabled и loading не нажимаются; при загрузке спиннер вместо иконки', async () => {
    const onClick = vi.fn()
    const w = mount(Button, {
      props: { loading: true },
      attrs: { onClick },
      slots: { icon: () => h('i', { class: 'icon' }), default: 'Текст' },
    })
    const el = w.get('button')
    expect(el.attributes('disabled')).toBeDefined()
    expect(el.classes()).toContain('bastyon-button-loading')
    expect(w.find('.icon').exists()).toBe(false)
    expect(w.find('[aria-hidden="true"]').exists()).toBe(true)
    await el.trigger('click')
    expect(onClick).not.toHaveBeenCalled()

    await w.setProps({ loading: false })
    expect(w.find('.icon').exists()).toBe(true)
    expect(el.attributes('disabled')).toBeUndefined()

    await w.setProps({ disabled: true })
    expect(el.attributes('disabled')).toBeDefined()
  })
})
