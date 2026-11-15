// Шторка: сбоку или снизу, слой шторки в стеке, Esc / «Назад» / маска
// закрывают (событие close), размер из пропа, содержимое остаётся.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { Z_INDEX } from '@/styles/design-tokens'
import { openLayers, resetLayersForTests } from '@/components/ui-core/layer-stack'
import { handleBack, resetBackHandlersForTests } from '@/composables/use-back-button'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import Drawer from './drawer.vue'

const mounted: VueWrapper[] = []

function mountDrawer(props: Record<string, unknown> = {}) {
  const open = ref(true)
  const onClose = vi.fn(() => (open.value = false))
  const w = mount(
    defineComponent({
      setup: () => () =>
        h(
          Drawer,
          { ...props, open: open.value, onClose },
          { title: () => 'Справка', default: () => h('p', { class: 'article' }, 'Статья') }
        ),
    }),
    { attachTo: document.body }
  )
  mounted.push(w)
  return { open, onClose }
}

const q = (sel: string): HTMLElement | null => document.querySelector(sel)

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  resetLayersForTests()
  resetBackHandlersForTests()
  document.body.innerHTML = ''
})

describe('Drawer', () => {
  it('справа шириной из пропа, в слое шторки; заголовок — название окна', async () => {
    mountDrawer({ width: 480, closable: false })
    await nextTick()
    const panel = q('.ui-drawer')!
    expect(q('.ui-drawer-root')!.dataset.placement).toBe('right')
    expect(panel.style.width).toBe('480px')
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(q(`#${panel.getAttribute('aria-labelledby')}`)?.textContent?.trim()).toBe('Справка')
    expect(q('.ui-drawer__close')).toBeNull()
    expect(openLayers().map((l) => [l.kind, l.zIndex])).toEqual([['drawer', Z_INDEX.MODAL]])
  })

  it('снизу — высота из пропа', async () => {
    mountDrawer({ placement: 'bottom', height: '85%' })
    await nextTick()
    expect(q('.ui-drawer')!.style.height).toBe('85%')
    expect(q('.ui-drawer')!.style.width).toBe('')
  })

  it('Esc, «Назад», маска и крестик закрывают; содержимое остаётся', async () => {
    const { open, onClose } = mountDrawer()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(q('.article')).not.toBeNull()
    open.value = true
    await nextTick()
    expect(handleBack()).toBe(true)
    await nextTick()
    open.value = true
    await nextTick()
    q('.ui-drawer-mask')!.click()
    await nextTick()
    open.value = true
    await nextTick()
    q('.ui-drawer__close')!.click()
    expect(onClose).toHaveBeenCalledTimes(4)
  })
})
