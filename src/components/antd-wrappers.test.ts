// Обёртки antd в src/components обязаны доносить объявленные пропсы и слоты
// до antd (аудит X8: K6 «Enter в поиске мёртв», V13 «мнемоника открытым
// текстом», S63 «модалки без заголовка», Empty без иллюстрации).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import Input from './input/input.vue'
import InputSearch from './input-search/input-search.vue'
import Modal from './modal/modal.vue'
import Card from './card/card.vue'
import Empty from './empty/empty.vue'
import Spin from './spin/spin.vue'

const mounted: Array<{ unmount: () => void }> = []
const keep = <T extends { unmount: () => void }>(w: T): T => (mounted.push(w), w)
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('Input (обёртка)', () => {
  it('type/placeholder/disabled/allowClear доходят до DOM (V13)', async () => {
    const w = keep(
      mount(Input, {
        props: {
          type: 'password',
          placeholder: 'seed',
          disabled: true,
          allowClear: true,
          value: 'x',
        },
      })
    )
    const input = w.find('input')
    expect(input.attributes('type')).toBe('password')
    expect(input.attributes('placeholder')).toBe('seed')
    expect(input.attributes('disabled')).toBeDefined()
    expect(w.find('.ant-input-clear-icon').exists()).toBe(true)
    await w.setProps({ type: 'text', disabled: false })
    expect(w.find('input').attributes('type')).toBe('text')
    expect(w.find('input').attributes('disabled')).toBeUndefined()
  })

  it('атрибуты не дублируются на обёртке (inheritAttrs=false)', () => {
    const w = keep(mount(Input, { attrs: { autocomplete: 'off', class: 'my' } }))
    expect(w.find('input').attributes('autocomplete')).toBe('off')
    expect(w.element.getAttribute('autocomplete')).toBeNull()
  })
})

describe('InputSearch (обёртка)', () => {
  it('@search срабатывает по Enter и по кнопке, v-model:value контролирует поле (K6)', async () => {
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
    expect(w.find('input').attributes('placeholder')).toBe('find')
    expect((w.find('input').element as HTMLInputElement).value).toBe('abc')
    await w.find('input').trigger('keydown.enter')
    expect(onSearch).toHaveBeenCalledWith('abc', expect.anything())
    await w.find('input').setValue('new')
    await nextTick()
    expect((w.find('input').element as HTMLInputElement).value).toBe('new')
    await w.find('.ant-input-search-button').trigger('click')
    expect(onSearch).toHaveBeenCalledTimes(2)
  })
})

describe('Modal (обёртка)', () => {
  const mountModal = (props: Record<string, unknown>, slots: Record<string, string> = {}) =>
    keep(mount(Modal, { props: { open: true, ...props }, slots, attachTo: document.body }))

  it('title/centered/destroyOnClose доходят до antd (S63)', async () => {
    const w = mountModal({ title: 'Заголовок', centered: true, destroyOnClose: true })
    await nextTick()
    expect(document.body.querySelector('.ant-modal-title')?.textContent).toBe('Заголовок')
    expect(document.body.querySelector('.ant-modal-centered')).not.toBeNull()
    w.unmount()
  })

  it('без footer-пропа и слота — дефолтные кнопки antd не показываются; :footer=null тоже', async () => {
    const a = mountModal({ title: 't' })
    await nextTick()
    expect(document.body.querySelector('.ant-modal-footer .ant-btn')).toBeNull()
    a.unmount()
    const b = mountModal({ title: 't', footer: null })
    await nextTick()
    expect(document.body.querySelector('.ant-modal-footer')).toBeNull()
    b.unmount()
  })

  it('слот #footer и #title потребителя рендерятся', async () => {
    const w = mountModal(
      {},
      { footer: '<button class="my-ok">ok</button>', title: '<i class="my-title">T</i>' }
    )
    await nextTick()
    expect(document.body.querySelector('.ant-modal-footer .my-ok')).not.toBeNull()
    expect(document.body.querySelector('.ant-modal-title .my-title')).not.toBeNull()
    w.unmount()
  })

  it('cancel закрывает и эмитит update:open + cancel; onCancel зовётся один раз', async () => {
    const onCancel = vi.fn()
    const w = mountModal({ title: 't', onCancel })
    await nextTick()
    ;(document.body.querySelector('.ant-modal-close') as HTMLElement).click()
    await nextTick()
    expect(w.emitted('update:open')?.[0]).toEqual([false])
    expect(w.emitted('cancel')).toHaveLength(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
    w.unmount()
  })
})

describe('Card / Empty / Spin (обёртки)', () => {
  it('Card: title-проп рендерится, слот #extra — только если дан', () => {
    const w = keep(mount(Card, { props: { title: 'Карточка', bordered: false } }))
    expect(w.find('.ant-card-head-title').text()).toBe('Карточка')
    expect(w.find('.ant-card-extra').exists()).toBe(false)
    expect(w.find('.ant-card').classes()).not.toContain('ant-card-bordered')
  })

  it('Empty: описание из пропа и дефолтная иллюстрация', () => {
    const w = keep(mount(Empty, { props: { description: 'Пусто' } }))
    expect(w.find('.ant-empty-description').text()).toBe('Пусто')
    expect(w.find('.ant-empty-image svg').exists()).toBe(true)
  })

  it('Spin: spinning/tip доходят до antd', () => {
    const w = keep(mount(Spin, { props: { spinning: true, tip: 'Загрузка' } }))
    expect(w.find('.ant-spin-text').text()).toBe('Загрузка')
    expect(w.find('.ant-spin-spinning').exists()).toBe(true)
  })
})
