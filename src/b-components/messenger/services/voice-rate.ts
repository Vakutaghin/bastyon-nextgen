// Скорость голосовых сообщений — одна на все чаты: включили 1,5× в одном
// голосовом — так играют и остальные, пока скорость не сменят. Своя, не
// общая с видео (services/media/playback-rate): как в Telegram, голосовые
// часто слушают быстрее, чем смотрят ролики. Хранится на устройстве.

import { ref } from 'vue'
import { VOICE_PLAYBACK_RATE_KEY } from '@/blockchain/constants/storage'

/** По нажатию — следующая, после 2× — снова 1×. */
export const VOICE_RATES: readonly number[] = [1, 1.25, 1.5, 1.75, 2]

function readRate(): number {
  try {
    const n = Number(localStorage.getItem(VOICE_PLAYBACK_RATE_KEY))
    return VOICE_RATES.includes(n) ? n : 1
  } catch {
    return 1
  }
}

/** Выбранная скорость; плееры голосовых читают её и следят за сменой. */
export const voiceRate = ref<number>(readRate())

/** Следующая скорость по кругу; запоминается на устройстве. */
export function nextVoiceRate(): number {
  const i = VOICE_RATES.indexOf(voiceRate.value)
  const rate = VOICE_RATES[(i + 1) % VOICE_RATES.length] ?? 1
  voiceRate.value = rate
  try {
    if (rate === 1) localStorage.removeItem(VOICE_PLAYBACK_RATE_KEY)
    else localStorage.setItem(VOICE_PLAYBACK_RATE_KEY, String(rate))
  } catch {
    // Без хранилища скорость живёт до перезапуска.
  }
  return rate
}

/** Для тестов: перечитать сохранённое. */
export function reloadVoiceRateForTests(): void {
  voiceRate.value = readRate()
}
