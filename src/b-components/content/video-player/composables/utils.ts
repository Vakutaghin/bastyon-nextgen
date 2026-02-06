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
