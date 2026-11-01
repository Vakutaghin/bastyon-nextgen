// Скорость — одна на все плееры: сохраняется на устройстве, чужое значение в
// хранилище не ломает выбор, смена в одном плеере доходит до остальных.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { PLAYBACK_RATE_KEY } from '@/blockchain/constants/storage'
import { playbackRate, reloadPlaybackRateForTests, setPlaybackRate } from './playback-rate'
import { useVideoPlaybackRate } from '@/b-components/content/video-player/composables/use-video-playback-rate'

describe('playback-rate', () => {
  beforeEach(() => {
    localStorage.clear()
    reloadPlaybackRateForTests()
  })
  afterEach(() => localStorage.clear())

  it('выбор запоминается; 1x не хранится; мусор в хранилище — 1x', () => {
    expect(playbackRate.value).toBe(1)
    setPlaybackRate(1.5)
    expect(localStorage.getItem(PLAYBACK_RATE_KEY)).toBe('1.5')
    reloadPlaybackRateForTests()
    expect(playbackRate.value).toBe(1.5)

    setPlaybackRate(3)
    expect(playbackRate.value).toBe(1.5)
    setPlaybackRate(1)
    expect(localStorage.getItem(PLAYBACK_RATE_KEY)).toBeNull()

    localStorage.setItem(PLAYBACK_RATE_KEY, '7')
    reloadPlaybackRateForTests()
    expect(playbackRate.value).toBe(1)
  })

  it('смена в одном плеере — у второго та же скорость; шаги идут от общей', async () => {
    const a = document.createElement('video')
    const b = document.createElement('video')
    const scope = effectScope()
    const [first, second] = scope.run(() => [
      useVideoPlaybackRate(ref(a), ref(false), () => {}),
      useVideoPlaybackRate(ref(b), ref(false), () => {}),
    ])!
    first.setPlaybackRate(1.25)
    await nextTick()
    expect(a.playbackRate).toBe(1.25)
    expect(b.playbackRate).toBe(1.25)
    second.increasePlaybackRate()
    await nextTick()
    expect(playbackRate.value).toBe(1.5)
    expect(a.playbackRate).toBe(1.5)
    scope.stop()
  })
})
