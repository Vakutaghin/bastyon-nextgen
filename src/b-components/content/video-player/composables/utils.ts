import { type Ref } from 'vue'

/**
 * Значение ref'а на DOM-узел: либо сам элемент, либо инстанс Vue-компонента
 * (styled component), у которого корневой узел лежит в $el.
 */
export type ElementRefValue = Element | { $el?: unknown } | null | undefined

/**
 * Получает реальный DOM элемент из ref
 */
export const resolveDomElement = (elementRef: Ref<ElementRefValue>): HTMLElement | null => {
  const value = elementRef.value
  if (!value) return null

  if (value instanceof HTMLElement) {
    return value
  }

  const element = '$el' in value ? value.$el : value

  if (element instanceof HTMLElement) {
    return element
  }

  return null
}

/**
 * Получает реальный DOM элемент video из ref
 */
export const resolveVideoElement = (
  videoElementRef: Ref<ElementRefValue>
): HTMLVideoElement | null => {
  const value = videoElementRef.value
  if (!value) return null

  // Если это уже HTMLVideoElement, возвращаем его
  if (value instanceof HTMLVideoElement) {
    return value
  }

  // Если это компонент Vue (styled component), получаем $el
  const element = '$el' in value ? value.$el : value

  // Проверяем, что это HTMLVideoElement
  if (element instanceof HTMLVideoElement) {
    return element
  }

  // Если это другой элемент, пытаемся найти video внутри
  if (element instanceof Element) {
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
