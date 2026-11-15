// Окно: открыто по open / v-model, содержимое остаётся после закрытия (или
// снимается с destroyOnClose), слой в стеке, Esc / «Назад» / маска / крестик
// закрывают, кроме запрещённых; штатный футер; окна вопроса с хэндлом.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { Z_INDEX } from '@/styles/design-tokens'
import { openLayers, resetLayersForTests } from '@/components/ui-core/layer-stack'
import { handleBack, resetBackHandlersForTests } from '@/composables/use-back-button'
import { UI } from '@/components/testing/ui-selectors'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import Modal from './modal.vue'
import { confirm, info } from './index'

const mounted: VueWrapper[] = []

function mountModal(
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {}
) {
  const open = ref<boolean>((props.open as boolean | undefined) ?? true)
  const onCancel = vi.fn()
  const w = mount(
    defineComponent({
      setup: () => () =>
        h(
          Modal,
          {
            ...props,
            open: open.value,
            'onUpdate:open': (v: boolean) => (open.value = v),
            onCancel,
          },
          { default: () => h('p', { class: 'body-text' }, 'Тело'), ...slots }
        ),
    }),
    { attachTo: document.body }
  )
  mounted.push(w)
  return { w, open, onCancel }
}

const q = (sel: string): HTMLElement | null => document.querySelector(sel)

function key(name: string): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })
  )
}

function clickMask(): void {
  const wrap = q(UI.modalWrap)!
  wrap.dispatchEvent(new Event('pointerdown'))
  wrap.click()
}

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  resetLayersForTests()
  resetBackHandlersForTests()
  document.body.innerHTML = ''
})

describe('Modal', () => {
  it('окно с заголовком в слое окон: role, aria-modal, aria-labelledby, ширина, класс', async () => {
    mountModal({ title: 'Заголовок', width: 400, class: 'post-modal', 'data-testid': 'm' })
    await nextTick()
    const panel = q(`${UI.modal}.post-modal`)!
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(q(`#${panel.getAttribute('aria-labelledby')}`)?.textContent?.trim()).toBe('Заголовок')
    expect(panel.getAttribute('data-testid')).toBe('m')
    expect(panel.querySelector(UI.modalContent)).not.toBeNull()
    expect(panel.style.width).toBe('400px')
    expect(panel.closest('#ui-layers')).not.toBeNull()
    expect(openLayers().map((l) => [l.kind, l.zIndex])).toEqual([['modal', Z_INDEX.MODAL]])
    expect(q('.ui-modal-root')!.style.zIndex).toBe(String(Z_INDEX.MODAL))
  })

  it('без заголовка — aria-label; fullWidth — до колонки ленты', async () => {
    mountModal({ 'aria-label': 'Уведомления', fullWidth: true })
    await nextTick()
    expect(q(UI.modal)!.getAttribute('aria-label')).toBe('Уведомления')
    // happy-dom не знает min() в style — проверяем, что это не обычные 520px.
    expect(q(UI.modal)!.style.width).not.toBe('520px')
  })

  it('Esc, «Назад», маска и крестик закрывают и шлют cancel', async () => {
    for (const close of [
      () => key('Escape'),
      () => handleBack(),
      () => clickMask(),
      () => q(UI.modalClose)!.click(),
    ]) {
      const { open, onCancel, w } = mountModal()
      await nextTick()
      close()
      await nextTick()
      expect(open.value).toBe(false)
      expect(onCancel).toHaveBeenCalledTimes(1)
      w.unmount()
      mounted.splice(0)
      resetLayersForTests()
      resetBackHandlersForTests()
      document.body.innerHTML = ''
    }
  })

  it('keyboard: false, maskClosable: false, closable: false, ignoreBack — не закрывают', async () => {
    const { open } = mountModal({
      keyboard: false,
      maskClosable: false,
      closable: false,
      ignoreBack: true,
    })
    await nextTick()
    expect(q(UI.modalClose)).toBeNull()
    key('Escape')
    clickMask()
    expect(handleBack()).toBe(false)
    await nextTick()
    expect(open.value).toBe(true)
  })

  it('нажатие внутри окна, отпущенное на маске, окно не закрывает', async () => {
    const { open } = mountModal()
    await nextTick()
    q('.body-text')!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    q(UI.modalWrap)!.click()
    await nextTick()
    expect(open.value).toBe(true)
  })

  it('содержимое создаётся при первом открытии и остаётся; destroyOnClose — снимается', async () => {
    const a = mountModal({ open: false })
    await nextTick()
    expect(q('.body-text')).toBeNull()
    a.open.value = true
    await nextTick()
    expect(q('.body-text')).not.toBeNull()
    a.open.value = false
    await nextTick()
    expect(q('.body-text')).not.toBeNull()
    expect(openLayers()).toHaveLength(0)
  })

  it('штатный футер: «Отмена» закрывает, ОК зовёт onOk; footer: null — без футера', async () => {
    const onOk = vi.fn()
    const { open } = mountModal({
      okText: 'Сохранить',
      cancelText: 'Отмена',
      onOk,
      okType: 'danger',
    })
    await nextTick()
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.ui-modal__footer button')]
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Отмена', 'Сохранить'])
    expect(buttons[1]!.className).toMatch(/danger/)
    buttons[1]!.click()
    expect(onOk).toHaveBeenCalledTimes(1)
    buttons[0]!.click()
    await nextTick()
    expect(open.value).toBe(false)

    document.body.innerHTML = ''
    mountModal({ footer: null, okText: 'ОК' })
    await nextTick()
    expect(q('.ui-modal__footer')).toBeNull()
  })

  it('слот #footer и #title потребителя', async () => {
    mountModal(
      {},
      { title: () => 'Свой заголовок', footer: () => h('button', { class: 'own' }, 'Своя') }
    )
    await nextTick()
    expect(q('.ui-modal__title')?.textContent?.trim()).toBe('Свой заголовок')
    expect(q('.ui-modal__footer .own')).not.toBeNull()
  })

  it('окно из окна — выше; Esc закрывает только верхнее', async () => {
    const first = mountModal()
    await nextTick()
    const second = mountModal()
    await nextTick()
    const [a, b] = openLayers()
    expect(b!.zIndex).toBe(a!.zIndex + 1)
    key('Escape')
    await nextTick()
    expect(second.open.value).toBe(false)
    expect(first.open.value).toBe(true)
  })
})

describe('окна вопроса', () => {
  it('confirm: заголовок, текст, «Отмена» и опасная ОК; ОК зовёт onOk и закрывает', async () => {
    const onOk = vi.fn()
    confirm({ title: 'Удалить?', content: 'Насовсем', okText: 'Удалить', danger: true, onOk })
    await nextTick()
    expect(q(`${UI.modal}${UI.confirm}`)).not.toBeNull()
    expect(q('.ui-confirm__title')?.textContent).toBe('Удалить?')
    expect(q('.ui-confirm__content')?.textContent).toBe('Насовсем')
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(`${UI.confirmButtons} button`)]
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['common.cancel', 'Удалить'])
    expect(buttons[1]!.matches(UI.dangerButton)).toBe(true)
    buttons[1]!.click()
    await nextTick()
    expect(onOk).toHaveBeenCalledTimes(1)
    expect(openLayers()).toHaveLength(0)
  })

  it('onOk с Promise: кнопка крутится, отказ оставляет окно открытым', async () => {
    let reject!: (e: Error) => void
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    confirm({ title: 'Сохранить?', onOk: () => new Promise((_, r) => (reject = r)) })
    await nextTick()
    const ok = [...document.querySelectorAll<HTMLButtonElement>(`${UI.confirmButtons} button`)][1]!
    ok.click()
    await nextTick()
    expect(ok.className).toMatch(/loading/)
    reject(new Error('нет сети'))
    await new Promise((r) => setTimeout(r, 0))
    await nextTick()
    expect(openLayers()).toHaveLength(1)
    expect(ok.className).not.toMatch(/loading/)
    err.mockRestore()
  })

  it('info — одна кнопка; хэндл update меняет текст, destroy закрывает; Esc — onCancel', async () => {
    const handle = info({ title: 'Готово', content: 'Первый' })
    await nextTick()
    expect(document.querySelectorAll(`${UI.confirmButtons} button`)).toHaveLength(1)
    handle.update({ content: 'Второй' })
    await nextTick()
    expect(q('.ui-confirm__content')?.textContent).toBe('Второй')
    handle.destroy()
    await nextTick()
    expect(openLayers()).toHaveLength(0)

    const onCancel = vi.fn()
    confirm({ title: 'Выйти?', onCancel })
    await nextTick()
    key('Escape')
    await nextTick()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
