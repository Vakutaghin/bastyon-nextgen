// TorImage (V21, вариант B): без Tor — обычный <img> с проброшенными атрибутами;
// под Tor — заглушка, по клику загрузка через appFetch (torFetch) в blob.

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({ appFetch: vi.fn() }))
vi.mock('@/helpers/api/fetch-strategies', () => ({ appFetch: mocks.appFetch }))

import { i18n } from '@/i18n'
import { useTorStore } from '@/stores/tor-store'
import TorImage from './tor-image.vue'
import { getTorImageUrl, resetTorImageCache } from './tor-image-cache'

const mounted: Array<{ unmount: () => void }> = []
const keep = <T extends { unmount: () => void }>(w: T): T => (mounted.push(w), w)

const SRC = 'https://pocketnet.app:8092/i/abc'

describe('TorImage', () => {
  let objectUrls = 0
  beforeEach(() => {
    setActivePinia(createPinia())
    resetTorImageCache()
    mocks.appFetch.mockReset()
    objectUrls = 0
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:tor-${++objectUrls}`),
      revokeObjectURL: vi.fn(),
    })
  })
  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    vi.unstubAllGlobals()
  })

  function mountImage() {
    return keep(
      mount(TorImage, {
        props: { src: SRC, alt: 'cat' },
        attrs: { loading: 'lazy', class: 'photo' },
        global: { plugins: [i18n] },
      })
    )
  }

  it('без Tor — обычный <img> с атрибутами и без сети', () => {
    const w = mountImage()
    const img = w.find('img')
    expect(img.attributes('src')).toBe(SRC)
    expect(img.attributes('alt')).toBe('cat')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.classes()).toContain('photo')
    expect(w.find('button').exists()).toBe(false)
    expect(mocks.appFetch).not.toHaveBeenCalled()
  })

  it('под Tor — заглушка вместо <img>; клик грузит через appFetch и показывает blob', async () => {
    const tor = useTorStore()
    tor.available = true
    tor.enabled = true
    tor.status = 'ready'
    mocks.appFetch.mockResolvedValue(
      new Response(new Blob(['png']), { status: 200, headers: { 'content-type': 'image/png' } })
    )

    const w = mountImage()
    expect(w.find('img').exists()).toBe(false)
    const gate = w.find('button')
    expect(gate.exists()).toBe(true)
    expect(gate.text()).toBe(i18n.global.t('torMedia.loadImage'))

    await gate.trigger('click')
    await vi.waitFor(() => expect(w.find('img').exists()).toBe(true))
    expect(mocks.appFetch).toHaveBeenCalledWith(SRC, { credentials: 'omit' })
    expect(w.find('img').attributes('src')).toBe('blob:tor-1')
    expect(w.emitted('loaded')?.[0]).toEqual(['blob:tor-1'])
    // Кэш: второй экземпляр с тем же src сразу показывает blob.
    expect(getTorImageUrl(SRC)).toBe('blob:tor-1')
    const w2 = mountImage()
    expect(w2.find('img').attributes('src')).toBe('blob:tor-1')
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)
  })

  it('ошибка загрузки — текст с «Повторить», повторный клик пробует снова', async () => {
    const tor = useTorStore()
    tor.available = true
    tor.enabled = true
    tor.status = 'ready'
    mocks.appFetch.mockRejectedValueOnce(new Error('tor_fetch failed'))

    const w = mountImage()
    await w.find('button').trigger('click')
    await vi.waitFor(() =>
      expect(w.find('button').text()).toContain(i18n.global.t('torMedia.loadFailed'))
    )
    mocks.appFetch.mockResolvedValueOnce(new Response(new Blob(['png']), { status: 200 }))
    await w.find('button').trigger('click')
    await vi.waitFor(() => expect(w.find('img').exists()).toBe(true))
    await nextTick()
    expect(mocks.appFetch).toHaveBeenCalledTimes(2)
  })
})
