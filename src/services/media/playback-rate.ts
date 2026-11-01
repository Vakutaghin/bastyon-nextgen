// Скорость воспроизведения — одна на всё приложение: выбрали 1.5x в одном
// плеере — так играют и остальные (лента, пост, окна, мини-плеер, фоновый
// звук на телефоне), пока скорость не сменят. Хранится на устройстве.

import { ref } from 'vue'
import { PLAYBACK_RATE_KEY } from '@/blockchain/constants/storage'

export const PLAYBACK_RATES: readonly number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

function readRate(): number {
  try {
    const n = Number(localStorage.getItem(PLAYBACK_RATE_KEY))
    return PLAYBACK_RATES.includes(n) ? n : 1
  } catch {
    return 1
  }
}

/** Выбранная скорость; плееры читают её при запуске и следят за сменой. */
export const playbackRate = ref<number>(readRate())

export function setPlaybackRate(rate: number): void {
  if (!PLAYBACK_RATES.includes(rate)) return
  playbackRate.value = rate
  try {
    if (rate === 1) localStorage.removeItem(PLAYBACK_RATE_KEY)
    else localStorage.setItem(PLAYBACK_RATE_KEY, String(rate))
  } catch {
    // Без хранилища скорость живёт до перезапуска.
  }
}

/** Для тестов: перечитать сохранённое. */
export function reloadPlaybackRateForTests(): void {
  playbackRate.value = readRate()
}
