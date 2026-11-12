// Картинка в чате на весь экран: Escape закрывает только просмотрщик, а не
// чат под ним (раньше событие всплывало до messenger-wrapper). Там же —
// кнопка «Скачать изображение».

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { reactive } from 'vue'
import { i18n, setI18nLocale } from '@/i18n'

vi.mock('@/helpers/common/download-media', () => ({ downloadMedia: vi.fn() }))

import ImageMessage from './image-message.vue'
import type { Message } from '../../types'

const message = {
  id: 'm1',
  url: 'blob:app/cat',
  info: { name: 'cat.jpg', w: 400, h: 300 },
} as unknown as Message

let wrapper: VueWrapper | null = null
const lightbox = () => document.body.querySelector('img[alt="cat.jpg"]:not([loading])')

describe('ImageMessage', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('Escape закрывает только просмотрщик — мессенджер о нём не узнаёт', async () => {
    const messenger = vi.fn()
    window.addEventListener('keydown', messenger)
    wrapper = mount(ImageMessage, {
      props: { message },
      attachTo: document.body,
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await wrapper.get('img[alt="cat.jpg"]').trigger('click')
    expect(lightbox()).not.toBeNull()
    expect(document.body.querySelector('[data-testid="media-download"]')).not.toBeNull()

    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
    await flushPromises()
    expect(lightbox()).toBeNull()
    expect(messenger).not.toHaveBeenCalled()

    // Просмотрщик закрыт — Escape снова достаётся мессенджеру.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(messenger).toHaveBeenCalledTimes(1)
    window.removeEventListener('keydown', messenger)
  })

  it('своё фото отправляется: кольцо сразу, проценты — когда пошла загрузка; снимок сменяется подготовленным', async () => {
    const sending = reactive({
      id: 'local-1',
      url: 'blob:app/picked',
      status: 'sending',
      info: { name: 'IMG_1.jpg', uploadProgress: 0 },
    }) as unknown as Message
    wrapper = mount(ImageMessage, {
      props: { message: sending },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    const badge = () => wrapper!.find('[data-testid="image-uploading"]')
    expect(badge().exists()).toBe(true)
    expect(badge().text()).toBe('')
    expect(wrapper.get('img').attributes('src')).toBe('blob:app/picked')

    // Фото подготовлено — новая ссылка; загрузка пошла.
    sending.url = 'blob:app/prepared'
    sending.info!.uploadProgress = 40
    await flushPromises()
    expect(wrapper.get('img').attributes('src')).toBe('blob:app/prepared')
    expect(badge().text()).toBe('40%')
    expect(badge().attributes('aria-label')).toBe('загрузка 40%')

    // Ушло (у неудачи статус failed) — кольца нет.
    sending.status = 'failed'
    delete sending.info!.uploadProgress
    await flushPromises()
    expect(badge().exists()).toBe(false)
  })
})
