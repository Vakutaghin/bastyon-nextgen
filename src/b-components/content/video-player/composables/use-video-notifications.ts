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

  /**
   * Показать уведомление о перемотке (+10s / -10s).
   * Сбрасывает предыдущую анимацию для корректного рестарта.
   */
  const triggerSeekNotification = (value: string) => {
    if (seekNotificationTimer) {
      clearTimeout(seekNotificationTimer)
      seekNotificationTimer = null
    }

    showSeekNotification.value = false

    // setTimeout(0) — для рестарта CSS-анимации через reflow
    setTimeout(() => {
      seekValue.value = value
      showSeekNotification.value = true

      seekNotificationTimer = setTimeout(() => {
        showSeekNotification.value = false
        seekNotificationTimer = null
      }, NOTIFICATION_DURATION)
    }, 0)
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
