// Composable: что горячие клавиши делают с этим плеером. Слушает клавиши и
// решает, какому плееру они достались, video-player-manager — один на все
// плееры, поэтому действие выполняется ровно один раз.

import { ref, type Ref } from 'vue'

import { FRAME_STEP, SEEK_STEP, SEEK_STEP_SHORT, VOLUME_STEP } from '../consts'
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
  /** «Картинка в картинке» по I; нет — клавиша не наша (аудио, система без PiP). */
  togglePip?: () => void
  /** Открыто меню настроек: Esc сначала закрывает его. */
  isMenuOpen?: () => boolean
  closeMenu?: () => void
}

/**
 * Раскладка YouTube: пробел и K — пуск и пауза, стрелки — 5 секунд, J и L —
 * 10, цифры — к доле ролика, Home и End — в начало и в конец, запятая и
 * точка — на кадр (на паузе), ↑ и ↓ — громкость на 5 %, M — звук, F — полный
 * экран, I — «картинка в картинке», Shift+> и Shift+< — скорость,
 * Shift+? — справка.
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
    togglePip,
    isMenuOpen,
    closeMenu,
  } = options

  const showHotkeysHelp = ref(false)

  const toggleHotkeysHelp = () => {
    showHotkeysHelp.value = !showHotkeysHelp.value
  }

  /** Ролик с метаданными; иначе перематывать нечего. */
  const loadedVideo = (): HTMLVideoElement | null => {
    const video = resolveVideoElement(videoElement)
    // До метаданных длительность — NaN, а currentTime = NaN бросает исключение.
    if (!video || !isInitialized.value || Number.isNaN(video.duration)) return null
    return video
  }

  /** Перемотка на `delta` секунд; `false` — ролик не загружен, перематывать нечего. */
  const seek = (delta: number): boolean => {
    const video = loadedVideo()
    if (!video) return false
    video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration)
    triggerSeekNotification(delta)
    return true
  }

  /** Переход к доле ролика `fraction` (0 — начало, 1 — конец). */
  const seekToFraction = (fraction: number): boolean => {
    const video = loadedVideo()
    if (!video) return false
    video.currentTime = video.duration * fraction
    return true
  }

  /** Кадр вперёд или назад — только на паузе, как у YouTube. */
  const stepFrame = (direction: 1 | -1): boolean => {
    const video = loadedVideo()
    if (!video || !video.paused) return false
    video.currentTime = Math.min(
      Math.max(video.currentTime + direction * FRAME_STEP, 0),
      video.duration
    )
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
        return seek(SEEK_STEP_SHORT)
      case 'seekBackward':
        return seek(-SEEK_STEP_SHORT)
      case 'seekForwardLong':
        return seek(SEEK_STEP)
      case 'seekBackwardLong':
        return seek(-SEEK_STEP)
      case 'seekStart':
        return seekToFraction(0)
      case 'seekEnd':
        return seekToFraction(1)
      case 'frameForward':
        return stepFrame(1)
      case 'frameBackward':
        return stepFrame(-1)
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
      case 'pip':
        if (!togglePip) return false
        togglePip()
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
        else if (isMenuOpen?.()) closeMenu?.()
        else if (isFullscreen.value) void toggleFullscreen()
        else return false
        return true
      default:
        // seekTo0 … seekTo9: цифра N — к N×10 % ролика.
        return seekToFraction(Number(action.slice('seekTo'.length)) / 10)
    }
  }

  return {
    showHotkeysHelp,
    toggleHotkeysHelp,
    handleHotkey,
  }
}
