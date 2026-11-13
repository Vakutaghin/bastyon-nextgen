// Карточка вместо обёртки над antd Card: корень .ui-card с атрибутами и
// классом потребителя (карточка поста — .post-card, role="article"), тело
// .ui-card__body со слотом.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Card from './index'
import Tag from '../tag'

describe('Card', () => {
  it('класс и атрибуты — на корень, содержимое — в тело', () => {
    const w = mount(Card, {
      attrs: { class: 'post-card', role: 'article' },
      slots: { default: '<p class="inner">Пост</p>' },
    })
    const root = w.get('.ui-card')
    expect(root.classes()).toContain('post-card')
    expect(root.attributes('role')).toBe('article')
    expect(w.find('.ui-card__body > .inner').exists()).toBe(true)
  })
})

describe('Tag', () => {
  it('span .ui-tag, нажатие и класс потребителя — на нём', async () => {
    let clicks = 0
    const w = mount(Tag, {
      attrs: { class: 'clickable', onClick: () => clicks++ },
      slots: { default: '#news' },
    })
    const tag = w.get('span.ui-tag')
    expect(tag.classes()).toContain('clickable')
    expect(tag.text()).toBe('#news')
    await tag.trigger('click')
    expect(clicks).toBe(1)
  })
})
