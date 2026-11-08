// Картинки статьи открываются в просмотрщике приложения: все картинки статьи
// по порядку, с той, на которую нажали.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { i18n } from '@/i18n'
import { useModalStore } from '@/stores/modal-store'
import BlockContent from './block-content.vue'

vi.mock('@/components/tor-image', () => ({
  default: { name: 'TorImage', props: ['src', 'alt'], template: '<img :src="src" :alt="alt" />' },
}))

const article = {
  blocks: [
    { id: '1', type: 'paragraph', data: { text: 'Начало' } },
    { id: '2', type: 'image', data: { file: { url: 'https://img/one.jpg' }, caption: 'Раз' } },
    { id: '3', type: 'paragraph', data: { text: 'Середина' } },
    { id: '4', type: 'image', data: { url: 'https://img/two.jpg' } },
  ],
}

beforeEach(() => setActivePinia(createPinia()))

describe('BlockContent: картинки статьи', () => {
  it('нажатие открывает просмотрщик со всеми картинками статьи, начиная с нажатой', async () => {
    const wrapper = mount(BlockContent, {
      props: { content: JSON.stringify(article) },
      global: { plugins: [i18n] },
    })
    const gallery = vi.spyOn(useModalStore(), 'openImageGallery').mockImplementation(() => {})
    const images = wrapper.findAll('[data-testid="article-image"]')
    expect(images).toHaveLength(2)

    await images[1]!.trigger('click')
    expect(gallery).toHaveBeenCalledWith(['https://img/one.jpg', 'https://img/two.jpg'], 1)
  })
})
