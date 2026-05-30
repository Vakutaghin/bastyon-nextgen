import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { resolveVideoElement } from './utils'

// Vendor-префиксы для Fullscreen API — Safari/старый Firefox/IE. Типизируем
// одним местом, чтобы не сыпать `as any` по всему файлу.
type VendorDocument = Document & {
  webkitFullscreenElement?: Element | null
  mozFullScreenElement?: Element | null
  msFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
  mozCancelFullScreen?: () => Promise<void>
  msExitFullscreen?: () => Promise<void>
}

type VendorElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>
  mozRequestFullScreen?: () => Promise<void>
  msRequestFullscreen?: () => Promise<void>
}

// videoElement может быть raw <video> либо обёрткой `{ $el }` от vue3-styled-components,
// поэтому держим расширенный Ref-тип на стороне вызывающего.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VideoRef = Ref<any>

function getVendorFullscreenElement(): Element | null {
  const d = document as VendorDocument
  return (
    document.fullscreenElement ||
    d.webkitFullscreenElement ||
    d.mozFullScreenElement ||
    d.msFullscreenElement ||
    null
  )
}

export function useVideoFullscreen(
  videoElement: VideoRef,
  containerRef?: Ref<HTMLElement | null | { $el?: HTMLElement }>
) {
  const isFullscreen = ref(false)

  /** Обработка изменения полноэкранного режима. */
  const handleFullscreenChange = () => {
    // Если мы в Tauri и используется CSS fallback (без native API),
    // то событие fullscreenchange не придёт — но если пришло, значит реально вышли.
    isFullscreen.value = !!getVendorFullscreenElement()
  }

  /** Переключение полноэкранного режима. */
  const toggleFullscreen = async () => {
    // Учитываем и нативное состояние, и наш флаг (для CSS-fallback в Tauri).
    const shouldExit = !!getVendorFullscreenElement() || isFullscreen.value

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
      const d = document as VendorDocument
      const exitFullscreen =
        document.exitFullscreen ||
        d.webkitExitFullscreen ||
        d.mozCancelFullScreen ||
        d.msExitFullscreen

      if (exitFullscreen) {
        exitFullscreen
          .call(document)
          .then(() => {
            isFullscreen.value = false
          })
          .catch((err: unknown) => {
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
        const raw = containerRef.value
        container =
          raw instanceof HTMLElement
            ? raw
            : (raw as { $el?: HTMLElement }).$el instanceof HTMLElement
              ? (raw as { $el: HTMLElement }).$el
              : null
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

      const el = container as VendorElement
      const requestFullscreen =
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen

      if (requestFullscreen) {
        requestFullscreen
          .call(container)
          .then(() => {
            isFullscreen.value = true
          })
          .catch((err: unknown) => {
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
    toggleFullscreen,
  }
}
