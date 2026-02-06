import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { resolveVideoElement } from './utils'


export function useVideoFullscreen(videoElement: Ref<any>, containerRef?: Ref<HTMLElement | null>) {
  const isFullscreen = ref(false)

  /**
   * Обработка изменения полноэкранного режима
   */
  const handleFullscreenChange = () => {
    // Обновляем состояние на основе реального состояния DOM
    const isFullscreenElement = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    )

    // Если мы в Tauri и используется CSS fallback (без native API),
    // то мы не должны сбрасывать isFullscreen, если событие пришло от чего-то другого
    // Но обычно fullscreenchange срабатывает только при реальном изменении.
    // Если мы используем только CSS режим, то событие не придет.

    isFullscreen.value = isFullscreenElement
  }

  /**
   * Переключение полноэкранного режима
   */
  const toggleFullscreen = async () => {
    // Определяем текущее состояние (учитываем и нативное, и наш флаг)
    const isNativeFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    )

    // Если мы уже в полноэкранном режиме (нативном или CSS), то выходим
    const shouldExit = isNativeFullscreen || isFullscreen.value

    if (shouldExit) {
      // --- EXIT ---

      // 1. Tauri Window Normal
      if (isTauri()) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window')
          await getCurrentWindow().setFullscreen(false)
        } catch (e) {
          console.error('Failed to exit Tauri fullscreen window:', e)
        }
      }

      // 2. Element Exit
      const exitFullscreen = document.exitFullscreen ||
                            (document as any).webkitExitFullscreen ||
                            (document as any).mozCancelFullScreen ||
                            (document as any).msExitFullscreen

      if (exitFullscreen) {
        exitFullscreen.call(document).then(() => {
          isFullscreen.value = false
        }).catch((err: any) => {
          console.error('Error attempting to exit fullscreen:', err)
          isFullscreen.value = false // Force reset
        })
      } else {
        isFullscreen.value = false
      }

    } else {
      // --- ENTER ---

      // 1. Tauri Window Fullscreen
      if (isTauri()) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window')
          await getCurrentWindow().setFullscreen(true)
        } catch (e) {
          console.error('Failed to set Tauri fullscreen window:', e)
        }
      }

      // 2. Element Enter
      const video = resolveVideoElement(videoElement)
      if (!video) return

      let container: HTMLElement | null = null
      if (containerRef && containerRef.value) {
        container = (containerRef.value as any).$el || containerRef.value
      }

      if (!container) {
        let element: HTMLElement | null = video
        while (element && element.parentElement) {
          element = element.parentElement as HTMLElement
          if (element.classList && element.classList.contains('sc-video-container')) {
            container = element
            break
          }
        }
        if (!container) {
          container = video.parentElement?.parentElement as HTMLElement
        }
      }

      if (!container) return

      const requestFullscreen = container.requestFullscreen ||
                                (container as any).webkitRequestFullscreen ||
                                (container as any).mozRequestFullScreen ||
                                (container as any).msRequestFullscreen

      if (requestFullscreen) {
        requestFullscreen.call(container).then(() => {
          isFullscreen.value = true
        }).catch((err: any) => {
          console.error('Error attempting to enable fullscreen:', err)
          // Fallback: force state to true for CSS
          isFullscreen.value = true
        })
      } else {
        // Fallback if API not available
        isFullscreen.value = true
      }
    }
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
  })

  return {
    isFullscreen,
    toggleFullscreen
  }
}
