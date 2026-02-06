import { ref, computed, watch, nextTick } from 'vue'
import { Modal } from 'ant-design-vue'
import VideoPlayer from '@/b-components/content/video-player/video-player.vue'
import { SC_PlayerSection } from './styled'
import type { VideoPlayerModalProps, VideoPlayerModalEmits } from './types'

export function useVideoPlayerModal(
  p: VideoPlayerModalProps,
  emit: VideoPlayerModalEmits,
) {
  const videoPlayerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)
  const isOpen = computed(() => !!p.video && !!p.videoUrl)

  // Останавливаем видео
  const stopVideo = () => {
    nextTick(() => {
      if (videoPlayerRef.value) {
        // Получаем доступ к методам компонента через ref
        const playerInstance = videoPlayerRef.value as any
        if (playerInstance) {
          // Вызываем метод stopVideo если он доступен
          if (typeof playerInstance.stopVideo === 'function') {
            playerInstance.stopVideo()
          }
          // Также останавливаем через videoElement напрямую
          if (playerInstance.videoElement) {
            const videoElement = playerInstance.videoElement as HTMLVideoElement
            if (videoElement) {
              videoElement.pause()
              videoElement.currentTime = 0
              videoElement.src = ''
              videoElement.load() // Сбрасываем видео элемент
            }
          }
        }
      }
    })
  }

  // Останавливаем видео при закрытии модалки
  const handleClose = () => {
    stopVideo()
    emit('close')
  }

  // Следим за изменением open и останавливаем видео при закрытии
  watch(isOpen, (newIsOpen, oldIsOpen) => {
    if (oldIsOpen && !newIsOpen) {
      // Модалка закрылась - останавливаем видео
      stopVideo()
    }
  })

  return {
    Modal,
    VideoPlayer,
    SC_PlayerSection,
    videoPlayerRef,
    isOpen,
    handleClose
  }
}
