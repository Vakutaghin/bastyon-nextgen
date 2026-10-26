// Android: свернули приложение с играющим роликом — звук уходит в нативный
// плеер службы (WebView видео в фоне не играет); вернулись — видео продолжает
// с его места. Свернули на паузе — звук сам не включается, только «пуском»
// из уведомления.

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

const m = vi.hoisted(() => ({
  handle: null as null | Record<string, (arg?: number) => void>,
  owner: '',
  playNative: vi.fn(async () => {}),
  stopNative: vi.fn(async () => ({ active: true, position: 95, isPlaying: true })),
}))

vi.mock('@/plugins/background-media', () => ({
  BackgroundMedia: { playNative: m.playNative, stopNative: m.stopNative },
}))
vi.mock('./background-media-controller', async () => {
  const { ref } = await import('vue')
  return {
    appInBackground: ref(false),
    isAndroidNative: true,
    watchAppState: vi.fn(),
    backgroundMediaController: {
      claim: vi.fn(async (id: string, handle: Record<string, (arg?: number) => void>) => {
        m.owner = id
        m.handle = handle
      }),
      owns: (id: string) => m.owner === id,
      update: vi.fn(),
      release: vi.fn(),
    },
  }
})

import { appInBackground, backgroundMediaController } from './background-media-controller'
import { useBackgroundPlayback } from './use-background-playback'

let hidden = false

describe('useBackgroundPlayback: звук в фоне на Android', () => {
  const video = document.createElement('video')
  const isPlaying = ref(false)

  beforeEach(() => {
    hidden = false
    Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true })
    Object.defineProperty(video, 'currentSrc', {
      value: 'https://pt.example/v.mp4',
      configurable: true,
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    m.playNative.mockClear()
    m.stopNative.mockClear()
    m.owner = ''
    appInBackground.value = false
    isPlaying.value = false
    video.currentTime = 30
  })
  afterEach(() => vi.restoreAllMocks())

  function mountPlayer() {
    return mount(
      defineComponent({
        setup() {
          useBackgroundPlayback({
            playerId: ref('p1'),
            videoElement: ref(video),
            hls: ref(null),
            isPlaying,
            isAudio: ref(false),
            getMetadata: () => ({ title: 'Ролик' }),
          })
          return () => h('div')
        },
      })
    )
  }

  it('свернули — звук у нативного плеера с места видео; вернулись — видео с его места', async () => {
    const wrapper = mountPlayer()
    isPlaying.value = true
    await flushPromises()

    appInBackground.value = true
    await flushPromises()
    expect(m.playNative).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://pt.example/v.mp4', position: 30, isPlaying: true })
    )
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()

    // Видео встало — уведомление о паузе не шлём: состояние у нативного плеера.
    vi.mocked(backgroundMediaController.update).mockClear()
    isPlaying.value = false
    await flushPromises()
    expect(backgroundMediaController.update).not.toHaveBeenCalled()

    // Capacitor говорит «вернулись» раньше, чем страница станет видна: play() — после.
    hidden = true
    vi.mocked(HTMLMediaElement.prototype.play).mockClear()
    appInBackground.value = false
    await flushPromises()
    expect(m.stopNative).toHaveBeenCalled()
    expect(video.currentTime).toBe(95)
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('свернули на паузе — звук сам не включается, «пуск» из уведомления — включает', async () => {
    const wrapper = mountPlayer()
    isPlaying.value = true
    await flushPromises()
    isPlaying.value = false
    await flushPromises()

    appInBackground.value = true
    await flushPromises()
    expect(m.playNative).not.toHaveBeenCalled()

    m.handle!.onPlay!()
    expect(m.playNative).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('свой файл до загрузки (blob:) нативному плееру не открыть — остаётся видео', async () => {
    Object.defineProperty(video, 'currentSrc', { value: 'blob:app/1', configurable: true })
    const wrapper = mountPlayer()
    isPlaying.value = true
    await flushPromises()
    appInBackground.value = true
    await flushPromises()
    expect(m.playNative).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
