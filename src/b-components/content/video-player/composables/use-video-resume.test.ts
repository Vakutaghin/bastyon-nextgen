import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'

import type { ElementRefValue } from './utils'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(() => Promise.resolve()),
  clear: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/db/apis/video-progress-api', () => ({ videoProgressAPI: api }))

import { useVideoResume } from './use-video-resume'

const VIDEO_URL = 'https://cdn.example.org/videos/clip.mp4'

function mountResume(videoElement: Ref<ElementRefValue>) {
  return mount(
    defineComponent({
      setup() {
        useVideoResume({ videoElement, videoUrl: () => VIDEO_URL })
        return () => h('div')
      },
    })
  )
}

function videoOfDuration(duration: number): HTMLVideoElement {
  const video = document.createElement('video')
  Object.defineProperty(video, 'duration', { value: duration })
  return video
}

describe('useVideoResume', () => {
  beforeEach(() => {
    api.get.mockReset()
  })

  it('слушает сам <video>, а не styled-обёртку, которую Vue кладёт в ref', async () => {
    api.get.mockResolvedValue(null)
    const video = document.createElement('video')
    const listen = vi.spyOn(video, 'addEventListener')
    const elementRef = ref<ElementRefValue>(null)
    mountResume(elementRef)

    elementRef.value = { $el: video }
    await nextTick()

    expect(listen.mock.calls.map(([event]) => event)).toEqual([
      'loadedmetadata',
      'timeupdate',
      'pause',
      'ended',
    ])
  })

  it('продолжает ролик с сохранённой позиции', async () => {
    api.get.mockResolvedValue({ position: 300, duration: 600 })
    const video = videoOfDuration(600)
    const elementRef = ref<ElementRefValue>(null)
    mountResume(elementRef)

    elementRef.value = { $el: video }
    await nextTick()
    video.dispatchEvent(new Event('loadedmetadata'))
    await vi.waitFor(() => expect(video.currentTime).toBe(300))
    expect(api.get).toHaveBeenCalledWith('cdn.example.org/videos/clip.mp4')
  })

  it('снимает слушатели при размонтировании', async () => {
    api.get.mockResolvedValue(null)
    const video = document.createElement('video')
    const unlisten = vi.spyOn(video, 'removeEventListener')
    const elementRef = ref<ElementRefValue>({ $el: video })
    const wrapper = mountResume(elementRef)
    await nextTick()

    wrapper.unmount()

    expect(unlisten).toHaveBeenCalledTimes(4)
  })
})
