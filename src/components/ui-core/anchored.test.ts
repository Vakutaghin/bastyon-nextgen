// v-anchored: панель держится у родителя или у названного элемента, перестаёт
// вместе с панелью; сам расчёт — floating.ts, здесь он подменён.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, withDirectives } from 'vue'

const { anchorFloating, release } = vi.hoisted(() => {
  const release = vi.fn()
  return { release, anchorFloating: vi.fn(() => release) }
})
vi.mock('./floating', () => ({ anchorFloating }))

import { FIELD_LIST, vAnchored, type AnchoredOptions } from './anchored'

afterEach(() => {
  anchorFloating.mockClear()
  release.mockClear()
})

function mountPanel(options?: AnchoredOptions) {
  const open = ref(true)
  const w = mount(
    defineComponent({
      setup: () => () =>
        h('div', { class: 'field' }, [
          open.value ? withDirectives(h('ul', { class: 'list' }), [[vAnchored, options]]) : null,
        ]),
    })
  )
  return { w, open }
}

describe('v-anchored', () => {
  it('ставит панель у родителя на месте и отпускает, когда её убрали', async () => {
    const { w, open } = mountPanel(FIELD_LIST)
    const [reference, panel, options] = anchorFloating.mock.calls[0] as unknown as [
      HTMLElement,
      HTMLElement,
      object,
    ]
    expect(reference).toBe(w.find('.field').element)
    expect(panel).toBe(w.find('.list').element)
    expect(options).toMatchObject({
      strategy: 'absolute',
      placement: 'bottomLeft',
      matchWidth: 'exact',
    })
    expect(release).not.toHaveBeenCalled()
    open.value = false
    await w.vm.$nextTick()
    expect(release).toHaveBeenCalledOnce()
  })

  it('место можно считать от другого элемента', () => {
    const other = document.createElement('button')
    mountPanel({ anchor: () => other, placement: 'topLeft' })
    expect((anchorFloating.mock.calls[0] as unknown[])[0]).toBe(other)
  })
})
