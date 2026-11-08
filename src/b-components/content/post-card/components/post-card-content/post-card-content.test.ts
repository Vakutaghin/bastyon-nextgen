// Статья в ленте открывается и нажатием на анонс, не только кнопкой «Читать
// статью». Ссылка в анонсе ведёт по ссылке, обычный пост от нажатия на текст
// не открывается.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { i18n } from '@/i18n'
import { useModalStore } from '@/stores/modal-store'
import PostCardContent from './post-card-content.vue'

const paragraph = (id: number, text: string) => ({
  id: String(id),
  type: 'paragraph',
  data: { text },
})

const article = {
  id: 'a1',
  type: 'article',
  content: JSON.stringify({
    blocks: [
      paragraph(1, 'Первый абзац <a href="https://example.com">ссылка</a>'),
      paragraph(2, 'Второй'),
      paragraph(3, 'Третий'),
      paragraph(4, 'Четвёртый'),
    ],
  }),
}

function render(post: Record<string, unknown>) {
  return mount(PostCardContent, {
    props: { post, maxBlocks: 3 },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => setActivePinia(createPinia()))

describe('PostCardContent: анонс статьи', () => {
  it('нажатие на анонс открывает статью', async () => {
    const wrapper = render(article)
    const open = vi.spyOn(useModalStore(), 'openPostModal').mockImplementation(() => {})
    await wrapper.find('[data-testid="article-preview"]').trigger('click')
    expect(open).toHaveBeenCalledWith(article)
  })

  it('нажатие на ссылку в анонсе статью не открывает', async () => {
    const wrapper = render(article)
    const open = vi.spyOn(useModalStore(), 'openPostModal').mockImplementation(() => {})
    const link = wrapper.find('[data-testid="article-preview"] a')
    link.element.addEventListener('click', (e) => e.preventDefault())
    await link.trigger('click')
    expect(open).not.toHaveBeenCalled()
  })

  it('обычный длинный пост по нажатию на текст не открывается', async () => {
    const wrapper = render({ id: 'p1', type: 'share', content: 'слово '.repeat(200) })
    const open = vi.spyOn(useModalStore(), 'openPostModal').mockImplementation(() => {})
    await wrapper.find('div').trigger('click')
    expect(wrapper.find('[data-testid="article-preview"]').exists()).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})
