// Обёртки antd в src/components обязаны доносить объявленные пропсы и слоты
// до antd (аудит X8: S63 «модалки без заголовка», Empty без иллюстрации).
// Поля (K6, V13) уже свои — их тесты рядом с ними.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import Modal from './modal/modal.vue'
import Empty from './empty/empty.vue'
import Select from './select/select.vue'
import { CloseOutlined } from './icons'

const mounted: Array<{ unmount: () => void }> = []
const keep = <T extends { unmount: () => void }>(w: T): T => (mounted.push(w), w)
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('Modal (обёртка)', () => {
  const mountModal = (props: Record<string, unknown>, slots: Record<string, string> = {}) =>
    keep(mount(Modal, { props: { open: true, ...props }, slots, attachTo: document.body }))

  it('окно модальное для диктора, aria-label — название окна без заголовка', async () => {
    mountModal({ 'aria-label': 'Уведомления' }, { default: '<p>тело</p>' })
    await nextTick()
    const dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Уведомления')
    expect(document.body.querySelectorAll('[aria-label="Уведомления"]')).toHaveLength(1)
  })

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
