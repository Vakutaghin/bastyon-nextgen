/**
 * Ресайз изображения на клиенте перед загрузкой (порт логики из
 * pocketnet.gui: resize до 1920×1080, GIF — без изменений).
 *
 * `computeResizedDimensions` — чистая функция (тестируется отдельно).
 * `resizeImageBase64` — DOM-обёртка (canvas), работает только в браузере.
 */

/** Целевой бокс по умолчанию (как в legacy share-композере). */
export const MAX_IMAGE_WIDTH = 1920
export const MAX_IMAGE_HEIGHT = 1080
/** Качество JPEG по умолчанию. */
export const IMAGE_QUALITY = 0.92

/**
 * Вписывает (w×h) в бокс (maxW×maxH) с сохранением пропорций.
 * Не увеличивает изображение (только уменьшает). Возвращает целые пиксели.
 */
export function computeResizedDimensions(
  width: number,
  height: number,
  maxWidth: number = MAX_IMAGE_WIDTH,
  maxHeight: number = MAX_IMAGE_HEIGHT
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }

  const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

/** Это GIF? (по data-URL префиксу) — GIF не ресайзим, чтобы не потерять анимацию. */
export function isGifDataUrl(base64: string): boolean {
  return base64.startsWith('data:image/gif')
}

export interface ResizeOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

/**
 * Ресайзит base64-изображение в пределах бокса. GIF возвращается как есть.
 * Результат — data:image/jpeg (или исходный формат для PNG с прозрачностью —
 * legacy конвертировал в JPEG; здесь сохраняем JPEG ради размера).
 */
export function resizeImageBase64(base64: string, options: ResizeOptions = {}): Promise<string> {
  if (isGifDataUrl(base64)) return Promise.resolve(base64)

  const {
    maxWidth = MAX_IMAGE_WIDTH,
    maxHeight = MAX_IMAGE_HEIGHT,
    quality = IMAGE_QUALITY,
  } = options

  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      const { width, height } = computeResizedDimensions(
        img.naturalWidth,
        img.naturalHeight,
        maxWidth,
        maxHeight
      )

      if (width === 0 || height === 0) {
        resolve(base64)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(base64)
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) {
        // toDataURL может бросить (tainted canvas) — отдаём оригинал.
        reject(e instanceof Error ? e : new Error('resize failed'))
      }
    }

    img.onerror = () => reject(new Error('Failed to load image for resize'))
    img.src = base64
  })
}

/** Читает File в data-URL (base64). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
