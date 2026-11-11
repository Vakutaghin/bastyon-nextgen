// Скорость голосовых: по кругу 1 → 1,25 → 1,5 → 1,75 → 2 → 1, одна на все
// чаты и запоминается на устройстве; со скоростью видео не связана.

import { afterEach, describe, expect, it } from 'vitest'
import { PLAYBACK_RATE_KEY, VOICE_PLAYBACK_RATE_KEY } from '@/blockchain/constants/storage'
import { nextVoiceRate, reloadVoiceRateForTests, voiceRate } from './voice-rate'

afterEach(() => {
  localStorage.clear()
  reloadVoiceRateForTests()
})

describe('voice-rate', () => {
  it('по кругу: 1 → 1,25 → 1,5 → 1,75 → 2 → 1', () => {
    expect(voiceRate.value).toBe(1)
    const seen = [1, 2, 3, 4, 5].map(() => nextVoiceRate())
    expect(seen).toEqual([1.25, 1.5, 1.75, 2, 1])
    expect(voiceRate.value).toBe(1)
  })

  it('запоминается на устройстве; 1× — запись убирается', () => {
    nextVoiceRate()
    nextVoiceRate()
    expect(localStorage.getItem(VOICE_PLAYBACK_RATE_KEY)).toBe('1.5')
    voiceRate.value = 0
    reloadVoiceRateForTests()
    expect(voiceRate.value).toBe(1.5)

    nextVoiceRate()
    nextVoiceRate()
    nextVoiceRate()
    expect(voiceRate.value).toBe(1)
    expect(localStorage.getItem(VOICE_PLAYBACK_RATE_KEY)).toBeNull()
  })

  it('чужое значение в хранилище и скорость видео — не скорость голосовых', () => {
    localStorage.setItem(VOICE_PLAYBACK_RATE_KEY, '0.5')
    localStorage.setItem(PLAYBACK_RATE_KEY, '2')
    reloadVoiceRateForTests()
    expect(voiceRate.value).toBe(1)
    expect(nextVoiceRate()).toBe(1.25)
  })
})
