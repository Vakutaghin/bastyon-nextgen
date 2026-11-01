// «Далее» на странице поста: название очереди — ссылка на сам плейлист;
// закрыть очередь — через меню «⋯», а не крестиком рядом с «Далее».

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'
import { usePlaybackQueueStore } from '@/stores/playback-queue-store'
import UpNext from './up-next.vue'

const Stub = defineComponent({ template: '<div />' })

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/post/:txid', name: 'post', component: Stub },
      { path: '/collection/:txid', component: Stub },
    ],
  })
}

const item = (id: string) => ({
  id,
  type: 'video' as const,
  url: `peertube://h/${id}`,
  title: id,
  artist: '',
  address: 'PA',
  cover: null,
  duration: 60,
})

describe('UpNext', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    document.body.innerHTML = ''
  })

  it('название ведёт на плейлист, «⋯ → Закрыть очередь» закрывает её', async () => {
    const router = makeRouter()
    await router.push('/post/a')
    const queue = usePlaybackQueueStore()
    queue.play([item('a'), item('b')], 0, { title: 'В дорогу', path: '/collection/x' })
    const wrapper = mount(UpNext, {
      attachTo: document.body,
      global: { plugins: [i18n, router], provide: { theme: {} } },
    })
    await flushPromises()

    const link = wrapper.find('[data-testid="up-next-source"]')
    expect(link.text()).toBe('В дорогу')
    expect(link.attributes('href')).toBe('/collection/x')
    expect(wrapper.find('button[aria-label="Закрыть очередь"]').exists()).toBe(false)

    await wrapper.find('[data-testid="up-next-more"]').trigger('click')
    await flushPromises()
    const items = Array.from(document.body.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item'))
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Открыть плейлист', 'Закрыть очередь'])
    items[1]!.click()
    await flushPromises()
    expect(queue.items).toHaveLength(0)
    wrapper.unmount()
  })
})
