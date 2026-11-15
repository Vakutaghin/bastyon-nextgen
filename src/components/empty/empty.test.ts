// Пустое состояние: подпись, заголовок и иконка из пропсов (аудит X8: Empty
// без иллюстрации).
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Empty from './empty.vue'
import { CloseOutlined } from '../icons'

const mounted: Array<{ unmount: () => void }> = []
const keep = <T extends { unmount: () => void }>(w: T): T => (mounted.push(w), w)
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('Empty', () => {
  it('подпись из пропа и иконка в круге, как UEmpty', () => {
    const w = keep(mount(Empty, { props: { description: 'Пусто' } }))
    expect(w.text()).toBe('Пусто')
    expect(w.find('.anticon svg').exists()).toBe(true)
  })

  it('заголовок и своя иконка', () => {
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
