// TorImage (V21): без Tor — обычный <img> с проброшенными атрибутами; под Tor
// на компьютере — тот же <img>, но через свою схему `bastyon-tor` (её отдаёт
// Rust через Tor), без заглушки и без нажатия.

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { i18n } from '@/i18n'
import { useTorStore } from '@/stores/tor-store'
import TorImage from './tor-image.vue'

const mounted: Array<{ unmount: () => void }> = []
const keep = <T extends { unmount: () => void }>(w: T): T => (mounted.push(w), w)

const SRC = 'https://pocketnet.app:8092/i/abc'

describe('TorImage', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

  function mountImage() {
    return keep(
      mount(TorImage, {
        props: { src: SRC, alt: 'cat' },
        attrs: { loading: 'lazy', class: 'photo' },
        global: { plugins: [i18n] },
      })
    )
  }

  it('без Tor — обычный <img> с атрибутами', () => {
    const img = mountImage().find('img')
    expect(img.attributes('src')).toBe(SRC)
    expect(img.attributes('alt')).toBe('cat')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.classes()).toContain('photo')
  })

  it('под Tor — та же картинка, но через Tor, сразу', () => {
    const tor = useTorStore()
    tor.available = true
    tor.enabled = true
    tor.status = 'ready'
    const w = mountImage()
    expect(w.find('button').exists()).toBe(false)
    const src = w.find('img').attributes('src')!
    expect(src).toMatch(/^(bastyon-tor:\/\/localhost|http:\/\/bastyon-tor\.localhost)\//)
    expect(decodeURIComponent(src.split('localhost/')[1]!)).toBe(SRC)
    expect(w.find('img').classes()).toContain('photo')
  })
})
