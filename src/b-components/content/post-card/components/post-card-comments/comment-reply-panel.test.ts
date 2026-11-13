// Плашка ответа с картинками: отправка из одних картинок, кнопка
// «Прикрепить картинку», миниатюры с кнопкой «убрать», блокировка на время
// загрузки и сжатия.
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (k: string) => k }),
}))
vi.mock('@/composables/use-auto-grow', () => ({ useAutoGrow: () => {} }))

import CommentReplyPanel from './comment-reply-panel.vue'
import type { CommentImage } from './composables/use-comment-images'

const IMG: CommentImage = { id: 'i1', src: 'data:image/png;base64,AAA' }

function panel(props: Partial<InstanceType<typeof CommentReplyPanel>['$props']> = {}) {
  return mount(CommentReplyPanel, {
    props: {
      currentUserAvatarUrl: null,
      currentUserInitial: 'A',
      showCancelModal: false,
      replyDraft: '',
      replyPanelKey: 'c1:empty',
      replySubmitting: false,
      showMentionList: false,
      filteredMentionUsers: [],
      mentionHighlightIndex: 0,
      replyImages: [],
      replyImagesProcessing: 0,
      replyImagesFull: false,
      replyUploading: false,
      ...props,
    },
    global: {
      stubs: {
        APopover: { template: '<span><slot /></span>' },
        CommentEmojiPicker: true,
      },
    },
  })
}

const sendBtn = (w: ReturnType<typeof panel>) => w.find('button[title="comments.send"]')

describe('comment-reply-panel — картинки', () => {
  it('без текста и картинок отправить нельзя; одной картинки достаточно', () => {
    expect(sendBtn(panel()).attributes('disabled')).toBeDefined()
    expect(sendBtn(panel({ replyImages: [IMG] })).attributes('disabled')).toBeUndefined()
  })

  it('пока картинка сжимается, отправить нельзя; на её месте — заглушка', () => {
    const w = panel({ replyDraft: 'текст', replyImagesProcessing: 1 })
    expect(sendBtn(w).attributes('disabled')).toBeDefined()
    expect(w.find('.is-processing').exists()).toBe(true)
  })

  it('«Прикрепить картинку» открывает выбор файлов и отдаёт выбранные', async () => {
    const w = panel()
    const input = w.find('[data-testid="comment-image-input"]')
    const click = vi.spyOn(input.element as HTMLInputElement, 'click')
    await w.find('[data-testid="comment-attach-image"]').trigger('click')
    expect(click).toHaveBeenCalled()

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    expect(w.emitted('add-images')).toEqual([[[file]]])
  })

  it('десять картинок или загрузка — кнопка прикрепления выключена', () => {
    const attach = (p: object) =>
      panel(p).find('[data-testid="comment-attach-image"]').attributes('disabled')
    expect(attach({})).toBeUndefined()
    expect(attach({ replyImagesFull: true })).toBeDefined()
    expect(attach({ replyUploading: true })).toBeDefined()
  })

  it('миниатюра убирается кнопкой; во время загрузки — нет, и поле только для чтения', async () => {
    const w = panel({ replyImages: [IMG] })
    expect(w.find('[data-testid="comment-image"] img').attributes('src')).toBe(IMG.src)
    await w.find('[data-testid="comment-image-remove"]').trigger('click')
    expect(w.emitted('remove-image')).toEqual([['i1']])

    const uploading = panel({ replyImages: [IMG], replyUploading: true })
    expect(
      uploading.find('[data-testid="comment-image-remove"]').attributes('disabled')
    ).toBeDefined()
    expect(uploading.find('textarea').attributes('readonly')).toBeDefined()
  })

  it('отмена с картинками предупреждает и о них', () => {
    expect(panel({ showCancelModal: true }).text()).toContain('comments.cancelConfirmMessage')
    expect(panel({ showCancelModal: true, replyImages: [IMG] }).text()).toContain(
      'comments.cancelConfirmDraft'
    )
  })

  it('вставка из буфера уходит наверх', async () => {
    const w = panel()
    await w.find('textarea').trigger('paste')
    expect(w.emitted('paste')).toHaveLength(1)
  })
})
