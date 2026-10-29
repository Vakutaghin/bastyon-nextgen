import { describe, it, expect } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useAutoGrow } from './use-auto-grow'

function mountField(initial: string) {
  const text = ref(initial)
  const el = ref<HTMLTextAreaElement | null>(null)
  const wrapper = mount(
    defineComponent({
      setup() {
        useAutoGrow(() => el.value, text)
        return () => h('textarea', { ref: el, rows: 2, value: text.value })
      },
    })
  )
  return { wrapper, text, field: () => wrapper.find('textarea').element as HTMLTextAreaElement }
}

describe('useAutoGrow', () => {
  // Замер — перекладка всей страницы, а пустое поле есть в каждой карточке ленты.
  it('does not measure an empty field on mount', () => {
    const { field } = mountField('')
    expect(field().style.height).toBe('')
  })

  it('measures a restored draft on mount', () => {
    const { field } = mountField('черновик')
    expect(field().style.height).toMatch(/px$/)
  })

  it('measures when the text changes, also back to empty', async () => {
    const { field, text } = mountField('')
    text.value = 'текст'
    await nextTick()
    await nextTick()
    expect(field().style.height).toMatch(/px$/)
    field().style.height = '120px'
    text.value = ''
    await nextTick()
    await nextTick()
    expect(field().style.height).not.toBe('120px')
  })
})
