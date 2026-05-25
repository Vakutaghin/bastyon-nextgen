import { type Ref } from 'vue'

/**
 * Получает реальный DOM элемент из ref
 */
export const resolveDomElement = (elementRef: Ref<any>): HTMLElement | null => {
  if (!elementRef.value) return null

  if (elementRef.value instanceof HTMLElement) {
    return elementRef.value
  }

  const element = (elementRef.value as any).$el || elementRef.value

  if (element instanceof HTMLElement) {
    return element
  }

  return null
}

/**
 * Получает реальный DOM элемент video из ref
 */
export const resolveVideoElement = (videoElementRef: Ref<any>): HTMLVideoElement | null => {
  if (!videoElementRef.value) return null

  // Если это уже HTMLVideoElement, возвращаем его
  if (videoElementRef.value instanceof HTMLVideoElement) {
    return videoElementRef.value
  }

  // Если это компонент Vue (styled component), получаем $el
  const element = (videoElementRef.value as any).$el || videoElementRef.value

  // Проверяем, что это HTMLVideoElement
  if (element instanceof HTMLVideoElement) {
    return element
  }

  // Если это другой элемент, пытаемся найти video внутри
  if (element && element.querySelector) {
    const video = element.querySelector('video')
    if (video instanceof HTMLVideoElement) {
      return video
    }
  }

  return null
}

/**
 * Запускает autoplay с fallback на muted.
 * Mobile Safari (и Chrome на Android) блокируют play() для unmuted видео без user gesture —
 * перезапускаем с muted=true, иначе плеер залипает на постере без сообщения.
 */
export const tryAutoplay = async (
  video: HTMLVideoElement
): Promise<{ played: boolean; muted: boolean }> => {
  try {
    await video.play()
    return { played: true, muted: video.muted }
  } catch (err) {
    if (video.muted) {
      console.warn('Autoplay failed even with muted:', err)
      return { played: false, muted: true }
    }
    try {
      video.muted = true
      await video.play()
      return { played: true, muted: true }
    } catch (mutedErr) {
      console.warn('Autoplay failed (both unmuted and muted):', mutedErr)
      return { played: false, muted: true }
    }
  }
}
