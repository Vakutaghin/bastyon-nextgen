/**
 * Извлечение метаданных из медиа-файлов перед загрузкой в комнату:
 * - {@link extractImageDimensions} — натуральные размеры (или null если не картинка)
 * - {@link extractVideoMetadata} — duration + размеры + first-frame poster (JPEG blob).
 *   Poster НЕ шифруется — клиенты видят превью до расшифровки самого видео.
 * - {@link stripPhotoMetadata} — фото без EXIF (место съёмки, модель, время).
 */

import {
  dataUrlBytes,
  sniffImage,
  stripJpegMetadata,
  stripPngMetadata,
} from '@/helpers/common/image-metadata'
import { fileToBase64, resizeImageBase64 } from '@/helpers/common/resize-image'

/** Наибольшая сторона, если битый файл пришлось перерисовать. */
const REDRAW_MAX_SIDE = 4096

/**
 * Фото без метаданных — перед отправкой в чат. Шифрование их не прячет от
 * собеседника: EXIF телефона выдаёт, где и когда снято фото.
 *
 * JPEG и PNG уходят без перекодирования, с теми же пикселями: метаданные
 * вырезаются из байтов. У повёрнутого фото остаётся один тег поворота, иначе
 * оно ляжет на бок. Битый JPEG или PNG разобрать нельзя — его перерисовывает
 * canvas (не больше 4096 по стороне); не вышло и это — уходит как был.
 * GIF, WebP и прочее — как есть: canvas убил бы анимацию.
 */
export async function stripPhotoMetadata(blob: Blob): Promise<Blob> {
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await blob.arrayBuffer())
  } catch {
    return blob
  }
  const kind = sniffImage(bytes)
  if (kind === 'other') return blob
  if (kind === 'jpeg') {
    const out = stripJpegMetadata(bytes, { keepOrientation: true })
    if (out) return new Blob([out as BlobPart], { type: 'image/jpeg' })
  } else {
    const out = stripPngMetadata(bytes)
    if (out) return new Blob([out.bytes as BlobPart], { type: 'image/png' })
  }
  try {
    const source = await fileToBase64(blob)
    const dataUrl = await resizeImageBase64(source, {
      maxWidth: REDRAW_MAX_SIDE,
      maxHeight: REDRAW_MAX_SIDE,
    })
    // Без размеров или без canvas resize отдаёт исходник — это не перерисовка.
    const redrawn = dataUrl === source ? null : dataUrlBytes(dataUrl)
    if (redrawn && sniffImage(redrawn) !== 'other') {
      const type = sniffImage(redrawn) === 'png' ? 'image/png' : 'image/jpeg'
      return new Blob([redrawn as BlobPart], { type })
    }
  } catch {
    // Браузер картинку не декодирует — ниже.
  }
  console.warn('[media-metadata] photo sent as is: cannot read or redraw', kind)
  return blob
}

/** Натуральные размеры картинки. null если файл не декодируется. */
export function extractImageDimensions(blob: Blob): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      URL.revokeObjectURL(url)
      resolve(w && h ? { w, h } : null)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

/**
 * Метаданные видео + первый кадр (poster).
 * `maxThumbDim` — максимальная сторона poster (по умолчанию 768).
 * При ошибках возвращает корректную структуру с нулями / null — не throws.
 */
export function extractVideoMetadata(
  blob: Blob,
  maxThumbDim = 768
): Promise<{ duration: number; w: number; h: number; posterBlob: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    let done = false
    const finalize = (result: {
      duration: number
      w: number
      h: number
      posterBlob: Blob | null
    }) => {
      if (done) return
      done = true
      URL.revokeObjectURL(url)
      resolve(result)
    }
    video.onerror = () => finalize({ duration: 0, w: 0, h: 0, posterBlob: null })
    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) ? video.duration : 0
      const w = video.videoWidth || 0
      const h = video.videoHeight || 0
      if (!w || !h) return finalize({ duration, w: 0, h: 0, posterBlob: null })
      // Seek в небольшую позицию, чтобы получить кадр (а не чёрный начальный кадр)
      const seekTo = Math.min(Math.max(0.1, duration * 0.05), 1.5)
      const onSeeked = () => {
        try {
          const scale = Math.min(1, maxThumbDim / Math.max(w, h))
          const tw = Math.max(1, Math.round(w * scale))
          const th = Math.max(1, Math.round(h * scale))
          const canvas = document.createElement('canvas')
          canvas.width = tw
          canvas.height = th
          const ctx = canvas.getContext('2d')
          if (!ctx) return finalize({ duration, w, h, posterBlob: null })
          ctx.drawImage(video, 0, 0, tw, th)
          canvas.toBlob((b) => finalize({ duration, w, h, posterBlob: b }), 'image/jpeg', 0.7)
        } catch {
          finalize({ duration, w, h, posterBlob: null })
        }
      }
      video.addEventListener('seeked', onSeeked, { once: true })
      try {
        video.currentTime = seekTo
      } catch {
        finalize({ duration, w, h, posterBlob: null })
      }
    }
    video.src = url
    try {
      video.load()
    } catch {
      /* ignore */
    }
  })
}
