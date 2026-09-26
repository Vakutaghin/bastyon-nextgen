// Composable: управление уведомлениями видеоплеера (play/pause, seek, volume, playback rate)

import { ref } from 'vue'

import { NOTIFICATION_DURATION } from '../consts'

/**
 * Управление анимированными уведомлениями (кратковременные pop-up
 * иконки в центре плеера при переключении play/pause, seek, и т.д.)
 */
export function useVideoNotifications() {
  const showPlayNotification = ref(false)
  const showPauseNotification = ref(false)
  const showSeekNotification = ref(false)
  const seekValue = ref('')

  let seekNotificationTimer: ReturnType<typeof setTimeout> | null = null
  let playPauseNotificationTimer: ReturnType<typeof setTimeout> | null = null
  /** Сдвиг текущей серии перемоток, секунды. */
  let seekTotal = 0

  /**
   * Показать уведомление о перемотке на `seconds` (+10s / -10s). Серия в одну
   * сторону, пока подсказка на экране (стрелку держат или жмут подряд),
   * копится: +10s, +20s, +30s — и подсказка не мигает на каждом шаге.
   */
  const triggerSeekNotification = (seconds: number) => {
    const sameRun = showSeekNotification.value && Math.sign(seekTotal) === Math.sign(seconds)
    seekTotal = sameRun ? seekTotal + seconds : seconds
    seekValue.value = `${seekTotal > 0 ? '+' : '-'}${Math.abs(seekTotal)}s`
    showSeekNotification.value = true

    if (seekNotificationTimer) clearTimeout(seekNotificationTimer)
    seekNotificationTimer = setTimeout(() => {
      showSeekNotification.value = false
      seekNotificationTimer = null
    }, NOTIFICATION_DURATION)
  }

  /**
   * Показать уведомление play/pause (иконка в центре).
   */
  const triggerPlayPauseNotification = (isPlay: boolean) => {
    if (playPauseNotificationTimer) {
      clearTimeout(playPauseNotificationTimer)
      playPauseNotificationTimer = null
    }

    showPlayNotification.value = false
    showPauseNotification.value = false

    setTimeout(() => {
      if (isPlay) {
        showPlayNotification.value = true
      } else {
        showPauseNotification.value = true
      }

      playPauseNotificationTimer = setTimeout(() => {
        showPlayNotification.value = false
        showPauseNotification.value = false
        playPauseNotificationTimer = null
      }, NOTIFICATION_DURATION)
    }, 0)
  }

  return {
    showPlayNotification,
    showPauseNotification,
    showSeekNotification,
    seekValue,
    triggerSeekNotification,
    triggerPlayPauseNotification,
  }
}
