// Composable: обработка горячих клавиш видеоплеера

import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

import { SEEK_STEP, VOLUME_STEP, VOLUME_NOTIFICATION_DURATION } from '../consts'
import { videoPlayerManager } from '../video-player-manager'
import { resolveVideoElement } from './utils'

/** Теги, в которых горячие клавиши игнорируются */
const IGNORED_TAGS = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']

interface UseVideoHotkeysOptions {
  videoElement: Ref<HTMLVideoElement | null>
  playerId: Ref<string>
  isHovering: Ref<boolean>
  isFullscreen: Ref<boolean>
  volume: Ref<number>
  showVolumeNotification: Ref<boolean>
  togglePlay: (showNotification?: boolean) => void
  toggleFullscreen: () => void
  toggleMute: () => void
  setVolume: (v: number) => void
  increasePlaybackRate: () => void
  decreasePlaybackRate: () => void
  triggerSeekNotification: (value: string) => void
}

/**
 * Обработка клавиатурных сочетаний для видеоплеера.
 * Space/K — play/pause, F — fullscreen, M — mute, стрелки — перемотка/громкость и т.д.
 */
export function useVideoHotkeys(options: UseVideoHotkeysOptions) {
  const {
    videoElement, playerId, isHovering, isFullscreen,
    volume, showVolumeNotification,
    togglePlay, toggleFullscreen, toggleMute, setVolume,
    increasePlaybackRate, decreasePlaybackRate, triggerSeekNotification,
  } = options

  const showHotkeysHelp = ref(false)

  const toggleHotkeysHelp = () => {
    showHotkeysHelp.value = !showHotkeysHelp.value
  }

  const handleKeydown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (IGNORED_TAGS.includes(target.tagName) || target.isContentEditable) return

    if (!videoPlayerManager.getHasUserInteracted()) return

    const isActivePlayer = videoPlayerManager.getLastActivePlayer()?.id === playerId.value

    // Space / K — play/pause
    if (e.code === 'Space' || e.code === 'KeyK') {
      if (isActivePlayer || isHovering.value || isFullscreen.value) {
        e.preventDefault()
        togglePlay(true)
        return
      }
    }

    if (!isHovering.value && !isFullscreen.value && !isActivePlayer) return

    const video = resolveVideoElement(videoElement)
    if (!video) return

    switch (e.code) {
      case 'ArrowRight':
      case 'KeyL':
        e.preventDefault()
        video.currentTime = Math.min(video.duration, video.currentTime + SEEK_STEP)
        triggerSeekNotification(`+${SEEK_STEP}s`)
        break

      case 'ArrowLeft':
      case 'KeyJ':
        e.preventDefault()
        video.currentTime = Math.max(0, video.currentTime - SEEK_STEP)
        triggerSeekNotification(`-${SEEK_STEP}s`)
        break

      case 'ArrowUp':
        e.preventDefault()
        setVolume(volume.value + VOLUME_STEP)
        showVolumeNotification.value = true
        setTimeout(() => { showVolumeNotification.value = false }, VOLUME_NOTIFICATION_DURATION)
        break

      case 'ArrowDown':
        e.preventDefault()
        setVolume(volume.value - VOLUME_STEP)
        showVolumeNotification.value = true
        setTimeout(() => { showVolumeNotification.value = false }, VOLUME_NOTIFICATION_DURATION)
        break

      case 'KeyF':
        e.preventDefault()
        toggleFullscreen()
        break

      case 'Slash':
        if (e.shiftKey) {
          e.preventDefault()
          toggleHotkeysHelp()
        }
        break

      case 'KeyM':
        e.preventDefault()
        toggleMute()
        break

      case 'Period':
        e.preventDefault()
        increasePlaybackRate()
        break

      case 'Comma':
        e.preventDefault()
        decreasePlaybackRate()
        break

      case 'Escape':
        if (showHotkeysHelp.value) {
          e.preventDefault()
          toggleHotkeysHelp()
        } else if (isFullscreen.value) {
          e.preventDefault()
          toggleFullscreen()
        }
        break
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
    showHotkeysHelp,
    toggleHotkeysHelp,
  }
}
