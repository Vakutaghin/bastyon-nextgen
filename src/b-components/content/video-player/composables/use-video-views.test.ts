// Плеер отмечает на видеосервере, что ролик смотрят: первая отметка через 5 с
// игры, дальше раз в 30 с, как прежний плеер Bastyon; перемотка помечается,
// досмотр — отметка в конце. Мелькнувший в ленте ролик и чужие ссылки не
// отмечаются; сбой сервера отметки не обрывает.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

import type { ElementRefValue } from './utils'
import type { reportVideoView, ViewReportResult } from '@/services/peertube/peertube-video-studio'
import { FIRST_VIEW_REPORT_MS, useVideoViews, VIEW_REPORT_INTERVAL_MS } from './use-video-views'

const POINTER = 'peertube://video.example.org/7d1f0c2e-1111-4222-8333-444455556666'

function fakeVideo(duration = 100) {
  const video = document.createElement('video')
  let time = 0
  let paused = true
  Object.defineProperty(video, 'duration', { value: duration })
  Object.defineProperty(video, 'currentTime', {
    get: () => time,
    set: (value: number) => (time = value),
  })
  Object.defineProperty(video, 'paused', { get: () => paused })
  const fire = (event: string) => video.dispatchEvent(new Event(event))
  return {
    video,
    play() {
      paused = false
      fire('playing')
    },
    pause() {
      paused = true
      fire('pause')
    },
    at(seconds: number) {
      time = seconds
    },
    fire,
  }
}

function mountViews(video: HTMLVideoElement, url = POINTER, result: ViewReportResult = 'accepted') {
  const report = vi.fn(
    async (_params: Parameters<typeof reportVideoView>[0]): Promise<ViewReportResult> => result
  )
  const element = ref<ElementRefValue>(video)
  const urlRef = ref(url)
  const wrapper = mount(
    defineComponent({
      setup() {
        useVideoViews({ videoElement: element, videoUrl: () => urlRef.value, report })
        return () => h('div')
      },
    })
  )
  return { report, wrapper, urlRef }
}

const sent = (report: ReturnType<typeof vi.fn>) =>
  report.mock.calls.map(([params]) => (params as { report: unknown }).report)

describe('useVideoViews', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('первая отметка — через 5 с игры, дальше раз в 30 с, на сервер ролика', async () => {
    const player = fakeVideo()
    const { report } = mountViews(player.video)
    player.play()

    player.at(4.9)
    await vi.advanceTimersByTimeAsync(FIRST_VIEW_REPORT_MS - 1)
    expect(report).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    player.at(34.7)
    await vi.advanceTimersByTimeAsync(VIEW_REPORT_INTERVAL_MS - 1)
    expect(report).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)

    expect(sent(report)).toEqual([{ currentTime: 4 }, { currentTime: 34 }])
    expect(report.mock.calls[0]![0]).toMatchObject({
      host: 'video.example.org',
      id: '7d1f0c2e-1111-4222-8333-444455556666',
    })
  })

  it('ролик, мелькнувший при прокрутке, не отмечается; на паузе — тишина', async () => {
    const player = fakeVideo()
    const { report } = mountViews(player.video)
    player.play()
    player.at(2)
    await vi.advanceTimersByTimeAsync(3000)
    player.pause()
    await vi.advanceTimersByTimeAsync(VIEW_REPORT_INTERVAL_MS * 3)
    expect(report).not.toHaveBeenCalled()
  })

  it('5 с набираются и с паузами', async () => {
    const player = fakeVideo()
    const { report } = mountViews(player.video)
    player.play()
    await vi.advanceTimersByTimeAsync(3000)
    player.pause()
    await vi.advanceTimersByTimeAsync(60_000)
    player.at(5)
    player.play()
    await vi.advanceTimersByTimeAsync(1999)
    expect(report).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(sent(report)).toEqual([{ currentTime: 5 }])
  })

  it('стоит на месте — повторно не отмечает', async () => {
    const player = fakeVideo()
    const { report } = mountViews(player.video)
    player.play()
    player.at(5)
    await vi.advanceTimersByTimeAsync(VIEW_REPORT_INTERVAL_MS * 3)
    expect(sent(report)).toEqual([{ currentTime: 5 }])
  })

  it('перемотка дальше 3 с помечается в следующей отметке — и до первой тоже', async () => {
    const player = fakeVideo()
    const { report } = mountViews(player.video)
    player.play()
    player.at(40)
    player.fire('seeked')
    await vi.advanceTimersByTimeAsync(FIRST_VIEW_REPORT_MS)
    player.at(70)
    await vi.advanceTimersByTimeAsync(VIEW_REPORT_INTERVAL_MS)
    player.at(90)
    player.fire('seeked')
    await vi.advanceTimersByTimeAsync(VIEW_REPORT_INTERVAL_MS)
    expect(sent(report)).toEqual([
      { currentTime: 40, viewEvent: 'seek' },
      { currentTime: 70 },
      { currentTime: 90, viewEvent: 'seek' },
    ])
  })

  it('короткий ролик, досмотренный до конца, отмечается в конце — не дальше длительности', async () => {
    const player = fakeVideo(3.6)
    const { report } = mountViews(player.video)
    player.play()
    player.at(3.6)
    player.fire('ended')
    await vi.advanceTimersByTimeAsync(0)
    expect(sent(report)).toEqual([{ currentTime: 3 }])
  })

  it('ролика на сервере нет — больше не отмечается', async () => {
    const player = fakeVideo()
    const { report } = mountViews(player.video, POINTER, 'rejected')
    player.play()
    player.at(5)
    await vi.advanceTimersByTimeAsync(FIRST_VIEW_REPORT_MS)
    player.at(40)
    await vi.advanceTimersByTimeAsync(VIEW_REPORT_INTERVAL_MS * 2)
    expect(report).toHaveBeenCalledTimes(1)
  })

  it('сервер перегружен или сети нет — отметки идут дальше', async () => {
    const player = fakeVideo()
    const { report } = mountViews(player.video, POINTER, 'failed')
    report.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    player.play()
    player.at(5)
    await vi.advanceTimersByTimeAsync(FIRST_VIEW_REPORT_MS)
    player.at(35)
    await vi.advanceTimersByTimeAsync(VIEW_REPORT_INTERVAL_MS)
    player.at(65)
    await vi.advanceTimersByTimeAsync(VIEW_REPORT_INTERVAL_MS)
    expect(sent(report)).toEqual([{ currentTime: 5 }, { currentTime: 35 }, { currentTime: 65 }])
  })

  it('не ролик видеосервера — не отмечает; смена ролика и размонтирование снимают отметки', async () => {
    const player = fakeVideo()
    const { report, urlRef, wrapper } = mountViews(player.video, 'https://example.org/clip.mp4')
    player.play()
    player.at(5)
    await vi.advanceTimersByTimeAsync(VIEW_REPORT_INTERVAL_MS)
    expect(report).not.toHaveBeenCalled()

    urlRef.value = POINTER
    await nextTick()
    player.play()
    player.at(9)
    await vi.advanceTimersByTimeAsync(FIRST_VIEW_REPORT_MS)
    expect(report).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    player.at(20)
    await vi.advanceTimersByTimeAsync(VIEW_REPORT_INTERVAL_MS * 2)
    expect(report).toHaveBeenCalledTimes(1)
  })
})
