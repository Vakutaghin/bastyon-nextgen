// Кнопка «Скачать» в просмотрщике картинок: сохраняет через downloadMedia,
// не вышло — говорит об этом рядом с кнопкой (тосты под просмотрщиком не видны).

import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const h = vi.hoisted(() => ({ downloadMedia: vi.fn() }))
vi.mock('@/helpers/common/download-media', () => ({ downloadMedia: h.downloadMedia }))

import MediaDownloadButton from './media-download-button.vue'

const render = () =>
  mount(MediaDownloadButton, {
    props: { src: 'blob:app/1', name: 'cat.jpg' },
    global: { plugins: [i18n] },
  })

describe('MediaDownloadButton', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => h.downloadMedia.mockReset())

  it('сохраняет картинку под её именем', async () => {
    h.downloadMedia.mockResolvedValue('saved')
    const w = render()
    expect(w.get('[data-testid="media-download"]').attributes('aria-label')).toBe(
      'Скачать изображение'
    )
    await w.get('[data-testid="media-download"]').trigger('click')
    await flushPromises()
    expect(h.downloadMedia).toHaveBeenCalledWith('blob:app/1', 'cat.jpg')
    expect(w.text()).not.toContain('Не удалось')
  })

  it('не вышло — говорит об этом; отмена диалога — молча', async () => {
    h.downloadMedia.mockResolvedValue('failed')
    const w = render()
    await w.get('[data-testid="media-download"]').trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toBe('Не удалось сохранить изображение')

    h.downloadMedia.mockResolvedValue('cancelled')
    await w.get('[data-testid="media-download"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').exists()).toBe(false)
  })

  it('второй клик, пока сохраняется, не начинает второе сохранение', async () => {
    let finish: (v: string) => void = () => {}
    h.downloadMedia.mockReturnValue(new Promise((r) => (finish = r)))
    const w = render()
    await w.get('[data-testid="media-download"]').trigger('click')
    await w.get('[data-testid="media-download"]').trigger('click')
    expect(h.downloadMedia).toHaveBeenCalledTimes(1)
    finish('saved')
    await flushPromises()
  })
})
