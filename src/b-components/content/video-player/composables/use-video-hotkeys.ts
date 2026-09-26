// Composable: что горячие клавиши делают с этим плеером. Слушает клавиши и
// решает, какому плееру они достались, video-player-manager — один на все
// плееры, поэтому действие выполняется ровно один раз.

import { ref, type Ref } from 'vue'

import { SEEK_STEP, VOLUME_STEP } from '../consts'
import type { HotkeyAction } from '../video-hotkeys'
import { resolveVideoElement } from './utils'

interface UseVideoHotkeysOptions {
  videoElement: Ref<HTMLVideoElement | null>
  isInitialized: Ref<boolean>
  isLoading: Ref<boolean>
  isFullscreen: Ref<boolean>
  /** Вместо ролика ошибка или предупреждение Tor: пробел — их кнопкам. */
  isUnavailable: () => boolean
  volume: Ref<number>
  togglePlay: (showNotification?: boolean) => void
  toggleFullscreen: () => void | Promise<void>
  toggleMute: () => void
  setVolume: (v: number) => void
  displayVolumeNotification: () => void
  increasePlaybackRate: () => void
  decreasePlaybackRate: () => void
  triggerSeekNotification: (seconds: number) => void
}

/**
 * Space/K — play/pause, F — fullscreen, M — mute, стрелки и J/L —
 * перемотка/громкость, Shift+> / Shift+< — скорость, Shift+? — справка.
 */
export function useVideoHotkeys(options: UseVideoHotkeysOptions) {
  const {
    videoElement,
    isInitialized,
    isLoading,
    isFullscreen,
    isUnavailable,
    volume,
    togglePlay,
    toggleFullscreen,
    toggleMute,
    setVolume,
    displayVolumeNotification,
    increasePlaybackRate,
    decreasePlaybackRate,
    triggerSeekNotification,
  } = options

  const showHotkeysHelp = ref(false)

  const toggleHotkeysHelp = () => {
    showHotkeysHelp.value = !showHotkeysHelp.value
  }

  /** Перемотка на `delta` секунд; `false` — ролик не загружен, перематывать нечего. */
  const seek = (delta: number): boolean => {
    const video = resolveVideoElement(videoElement)
    // До метаданных длительность — NaN, а currentTime = NaN бросает исключение.
    if (!video || !isInitialized.value || Number.isNaN(video.duration)) return false
    video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration)
    triggerSeekNotification(delta)
    return true
  }

  const changeVolume = (delta: number): void => {
    // Округляем, чтобы шаги по 0.1 не копили ошибку (0.7 + 0.1 = 0.7999…).
    setVolume(Math.round((volume.value + delta) * 100) / 100)
    displayVolumeNotification()
  }

  /** Выполняет действие клавиши; `false` — клавиша не плеера, пусть работает как обычно. */
  const handleHotkey = (action: HotkeyAction): boolean => {
    if (isUnavailable()) return false

    switch (action) {
      case 'playPause':
        // Первый запуск ещё грузится: повторный начал бы загрузку заново.
        if (isInitialized.value || !isLoading.value) togglePlay(true)
        return true
      case 'seekForward':
        return seek(SEEK_STEP)
      case 'seekBackward':
        return seek(-SEEK_STEP)
      case 'volumeUp':
        changeVolume(VOLUME_STEP)
        return true
      case 'volumeDown':
        changeVolume(-VOLUME_STEP)
        return true
      case 'mute':
        toggleMute()
        return true
      case 'fullscreen':
        void toggleFullscreen()
        return true
      case 'speedUp':
        increasePlaybackRate()
        return true
      case 'speedDown':
        decreasePlaybackRate()
        return true
      case 'help':
        toggleHotkeysHelp()
        return true
      case 'escape':
        if (showHotkeysHelp.value) toggleHotkeysHelp()
        else if (isFullscreen.value) void toggleFullscreen()
        else return false
        return true
    }
  }

  return {
    showHotkeysHelp,
    toggleHotkeysHelp,
    handleHotkey,
  }
}
