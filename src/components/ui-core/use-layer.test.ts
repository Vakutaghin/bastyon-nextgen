// Слой компонента: открыт, пока open, и z-index известен до отрисовки; снятие
// компонента закрывает слой. Портал рисует содержимое в #ui-layers в конце body.

import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { Z_INDEX } from '@/styles/design-tokens'
import { openLayers, resetLayersForTests } from './layer-stack'
import { LAYER_ROOT_ID } from './layer-root'
import { useLayer } from './use-layer'
import UiPortal from './ui-portal.vue'

afterEach(() => {
  resetLayersForTests()
  document.body.innerHTML = ''
})

describe('useLayer', () => {
  it('z-index готов к первой отрисовке; закрыли и сняли — слоя нет', async () => {
    const open = ref(true)
    const seen: number[] = []
    const Probe = defineComponent({
      setup() {
        const { zIndex } = useLayer(open, { kind: 'modal', el: () => null })
        return () => {
          seen.push(zIndex.value)
          return h('div')
        }
      },
    })
    const w = mount(Probe)
    expect(seen[0]).toBe(Z_INDEX.MODAL)
    expect(openLayers()).toHaveLength(1)
    open.value = false
    await nextTick()
    expect(openLayers()).toHaveLength(0)
    open.value = true
    await nextTick()
    expect(openLayers()).toHaveLength(1)
    w.unmount()
    expect(openLayers()).toHaveLength(0)
  })
})

describe('UiPortal', () => {
  it('рисует в #ui-layers в конце body; disabled — на месте', () => {
    const Host = defineComponent({
      props: { disabled: Boolean },
      setup(props) {
        return () =>
          h('section', { id: 'host' }, [
            h(UiPortal, { disabled: props.disabled }, () => h('p', { id: 'inner' }, 'x')),
          ])
      },
    })
    const w = mount(Host, { attachTo: document.body })
    const root = document.getElementById(LAYER_ROOT_ID)
    expect(root?.parentElement).toBe(document.body)
    expect(document.getElementById('inner')?.parentElement).toBe(root)
    w.unmount()
    const local = mount(Host, { props: { disabled: true }, attachTo: document.body })
    expect(document.getElementById('inner')?.parentElement?.id).toBe('host')
    local.unmount()
  })
})
