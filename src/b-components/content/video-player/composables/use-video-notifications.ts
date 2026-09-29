// Composable: знаки поверх ролика — как у YouTube. «Пульс» в центре на пуск,
// паузу и громкость и волна перемотки у края, которая копит секунды серии.

import { onBeforeUnmount, reactive } from 'vue'

import { NOTIFICATION_DURATION } from '../consts'
import { SEEK_CONTINUE_MS } from '../touch-gestures'

export type BezelIcon = 'play' | 'pause' | 'volumeUp' | 'volumeDown' | 'volumeOff'

export function useVideoNotifications() {
  /** «Пульс» в центре; `key` перезапускает анимацию на каждое нажатие. */
  const bezel = reactive({ icon: null as BezelIcon | null, key: 0 })
  /** Волна перемотки: сторона и сколько секунд набрано подряд в эту сторону. */
  const seek = reactive({ side: null as 'left' | 'right' | null, seconds: 0, key: 0 })

  let bezelTimer: ReturnType<typeof setTimeout> | null = null
  let seekTimer: ReturnType<typeof setTimeout> | null = null
  /** Сдвиг текущей серии перемоток, секунды со знаком. */
  let seekTotal = 0

  const flashBezel = (icon: BezelIcon) => {
    bezel.icon = icon
    bezel.key++
    if (bezelTimer) clearTimeout(bezelTimer)
    bezelTimer = setTimeout(() => {
      bezel.icon = null
      bezelTimer = null
    }, NOTIFICATION_DURATION)
  }

  /** Пуск или пауза — по нажатию, ещё до того, как ролик тронется. */
  const triggerPlayPauseNotification = (isPlay: boolean) => {
    flashBezel(isPlay ? 'play' : 'pause')
  }

  /**
   * Перемотка на `seconds` (+5 / -10…). Серия в одну сторону, пока волна на
   * экране (стрелку держат или жмут подряд), копится: 5, 10, 15 секунд — и
   * волна не мигает на каждом шаге.
   */
  const triggerSeekNotification = (seconds: number) => {
    const sameRun = seek.side !== null && Math.sign(seekTotal) === Math.sign(seconds)
    seekTotal = sameRun ? seekTotal + seconds : seconds
    seek.side = seekTotal > 0 ? 'right' : 'left'
    seek.seconds = Math.abs(seekTotal)
    seek.key++
    if (seekTimer) clearTimeout(seekTimer)
    seekTimer = setTimeout(() => {
      seek.side = null
      seek.seconds = 0
      seekTotal = 0
      seekTimer = null
    }, SEEK_CONTINUE_MS)
  }

  onBeforeUnmount(() => {
    if (bezelTimer) clearTimeout(bezelTimer)
    if (seekTimer) clearTimeout(seekTimer)
  })

  return {
    bezel,
    seek,
    flashBezel,
    triggerPlayPauseNotification,
    triggerSeekNotification,
  }
}
