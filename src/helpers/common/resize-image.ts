/**
 * Ресайз изображения на клиенте перед загрузкой (порт логики из
 * pocketnet.gui: resize до 1920×1080, GIF — без изменений).
 *
 * `computeResizedDimensions` — чистая функция (тестируется отдельно).
 * `resizeImageBase64` — DOM-обёртка (canvas), работает только в браузере.
 */

import { dataUrlByteLength, dataUrlBytes, sniffImage, stripImageMetadata } from './image-metadata'

/** Целевой бокс по умолчанию (как в legacy share-композере). */
export const MAX_IMAGE_WIDTH = 1920
export const MAX_IMAGE_HEIGHT = 1080
/**
 * Качество JPEG по умолчанию — как у прежнего клиента (functions.js `resize`).
 * С 0.92 фото 1620×1080 весило 492 КБ, с 0.85 — 361 КБ на глаз без разницы, а
 * каждую картинку поста скачивает каждый, кто листает ленту.
 */
export const IMAGE_QUALITY = 0.85
/**
 * Предел PNG с прозрачностью. Логотип или стикер в PNG весит сотни КБ, а
 * вырезанное фото 1920×1080 — несколько МБ: такое уходит JPEG на белом фоне.
 */
export const MAX_PNG_BYTES = 2 * 1024 * 1024

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

/** Есть ли на холсте хоть один не совсем непрозрачный пиксель. */
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, width, height).data
  } catch {
    return false
  }
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 255) return true
  }
  return false
}

/**
 * Кадр с холста. Прозрачная картинка — PNG: в JPEG прозрачные места
 * становились чёрными. PNG тяжелее предела — JPEG, но на белом фоне.
 */
export function encodeCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  transparent: boolean,
  quality: number = IMAGE_QUALITY
): string {
  if (!transparent) return canvas.toDataURL('image/jpeg', quality)
  const png = canvas.toDataURL('image/png')
  if (dataUrlByteLength(png) <= MAX_PNG_BYTES) return png
  // Белый фон под уже нарисованной картинкой — на весь холст: поворот и
  // фильтр редактора, оставшиеся у контекста, повернули бы и тонировали его.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Ресайзит base64-изображение в пределах бокса. GIF возвращается как есть.
 *
 * Результат:
 * - больше бокса — уменьшенный кадр: JPEG, а с прозрачностью — PNG
 *   (тяжелее MAX_PNG_BYTES — JPEG на белом фоне);
 * - в пределах бокса — так же перекодированный кадр или оригинал JPEG/PNG без
 *   метаданных (EXIF с местом съёмки и т.п.), если оригинал не тяжелее:
 *   уже сжатую картинку повторное сжатие только утяжеляло и портило;
 * - анимированный PNG в пределах бокса — оригинал без метаданных, как GIF.
 *
 * Метаданные не уходят на сервер ни в одном случае: canvas их не переносит,
 * а из оригинала они вырезаются (image-metadata.ts).
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
        // Формат — по байтам: у файла без типа (облако на Android) префикс
        // data-URL ставит вызывающий наугад. У JPEG прозрачности не бывает.
        const head = dataUrlBytes(base64, 12)
        const transparent =
          (!head || sniffImage(head) !== 'jpeg') && hasTransparency(ctx, width, height)
        const fitsBox = width === img.naturalWidth && height === img.naturalHeight
        const original = fitsBox ? stripImageMetadata(base64) : null
        if (original?.animated) {
          resolve(original.dataUrl)
          return
        }
        const encoded = encodeCanvas(canvas, ctx, transparent, quality)
        if (original && dataUrlByteLength(original.dataUrl) <= dataUrlByteLength(encoded)) {
          resolve(original.dataUrl)
          return
        }
        resolve(encoded)
      } catch (e) {
        // toDataURL может бросить (tainted canvas).
        reject(e instanceof Error ? e : new Error('resize failed'))
      }
    }

    img.onerror = () => reject(new Error('Failed to load image for resize'))
    img.src = base64
  })
}

/** Читает File (любой Blob) в data-URL (base64). */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
