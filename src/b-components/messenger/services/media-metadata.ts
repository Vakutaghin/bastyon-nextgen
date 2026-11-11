/**
 * Извлечение метаданных из медиа-файлов перед загрузкой в комнату:
 * - {@link extractImageDimensions} — натуральные размеры (или null если не картинка)
 * - {@link extractVideoMetadata} — duration + размеры + first-frame poster (JPEG blob).
 *   Poster НЕ шифруется — клиенты видят превью до расшифровки самого видео.
 * - {@link stripPhotoMetadata} — фото без EXIF (место съёмки, модель, время).
 * - {@link prepareChatPhoto} — фото для чата: без EXIF и не больше 2048 px.
 */

import {
  dataUrlBytes,
  sniffImage,
  stripJpegMetadata,
  stripPngMetadata,
} from '@/helpers/common/image-metadata'
import { fileToBase64, resizeImageBase64, type ResizeOptions } from '@/helpers/common/resize-image'

/** Наибольшая сторона, если битый файл пришлось перерисовать. */
const REDRAW_MAX_SIDE = 4096

/**
 * Длинная сторона фото в чате, px — как у forta.chat (`optimizeChatImage`).
 * Прежний чат Bastyon вписывал в 1024: на весь экран телефона это уже мыло.
 */
export const CHAT_PHOTO_MAX_SIDE = 2048
/** Качество JPEG фото в чате — как у forta.chat и прежнего чата. */
export const CHAT_PHOTO_QUALITY = 0.85
/**
 * JPEG в пределах стороны пережимается, только если тяжелее: лёгкий файл уже
 * сжат, пережатие ничего не выиграет, а качество съест.
 */
export const CHAT_PHOTO_REENCODE_MIN_BYTES = 500 * 1024

/** Фото после очистки и можно ли его ещё уменьшить. */
interface CleanPhoto {
  blob: Blob
  /**
   * Формат, который можно уменьшить. null — оставить как есть: GIF, WebP,
   * анимированный PNG (canvas убил бы анимацию), уже перерисованный или
   * нечитаемый файл.
   */
  shrinkable: 'jpeg' | 'png' | null
}

async function cleanPhoto(blob: Blob, redraw: ResizeOptions): Promise<CleanPhoto> {
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await blob.arrayBuffer())
  } catch {
    return { blob, shrinkable: null }
  }
  const kind = sniffImage(bytes)
  if (kind === 'other') return { blob, shrinkable: null }
  if (kind === 'jpeg') {
    const out = stripJpegMetadata(bytes, { keepOrientation: true })
    if (out)
      return { blob: new Blob([out as BlobPart], { type: 'image/jpeg' }), shrinkable: 'jpeg' }
  } else {
    const out = stripPngMetadata(bytes)
    if (out) {
      const png = new Blob([out.bytes as BlobPart], { type: 'image/png' })
      return { blob: png, shrinkable: out.animated ? null : 'png' }
    }
  }
  try {
    const source = await fileToBase64(blob)
    const dataUrl = await resizeImageBase64(source, redraw)
    // Без размеров или без canvas resize отдаёт исходник — это не перерисовка.
    const redrawn = dataUrl === source ? null : dataUrlBytes(dataUrl)
    if (redrawn && sniffImage(redrawn) !== 'other') {
      const type = sniffImage(redrawn) === 'png' ? 'image/png' : 'image/jpeg'
      // Перерисовано уже в нужном боксе — второй раз не пережимаем.
      return { blob: new Blob([redrawn as BlobPart], { type }), shrinkable: null }
    }
  } catch {
    // Браузер картинку не декодирует — ниже.
  }
  console.warn('[media-metadata] photo sent as is: cannot read or redraw', kind)
  return { blob, shrinkable: null }
}

/**
 * Фото без метаданных. Шифрование их не прячет от собеседника: EXIF телефона
 * выдаёт, где и когда снято фото.
 *
 * JPEG и PNG уходят без перекодирования, с теми же пикселями: метаданные
 * вырезаются из байтов. У повёрнутого фото остаётся один тег поворота, иначе
 * оно ляжет на бок. Битый JPEG или PNG разобрать нельзя — его перерисовывает
 * canvas (не больше 4096 по стороне); не вышло и это — уходит как был.
 * GIF, WebP и прочее — как есть: canvas убил бы анимацию.
 */
export async function stripPhotoMetadata(blob: Blob): Promise<Blob> {
  return (await cleanPhoto(blob, { maxWidth: REDRAW_MAX_SIDE, maxHeight: REDRAW_MAX_SIDE })).blob
}

/**
 * Фото для чата: без метаданных (как {@link stripPhotoMetadata}) и не больше
 * {@link CHAT_PHOTO_MAX_SIDE} по длинной стороне. Снимок с телефона — 4000 px
 * и 3–8 МБ, и каждый собеседник скачивал и расшифровывал его целиком, чтобы
 * просто увидеть в ленте чата: отдельного превью у фото нет.
 *
 * - больше стороны — уменьшается: JPEG с качеством 0.85, PNG остаётся PNG
 *   (скриншоты, прозрачность);
 * - JPEG в пределах стороны пережимается, только если тяжелее 500 КБ;
 *   PNG в пределах стороны — как есть;
 * - результат не легче исходника — уходит исходник;
 * - GIF, WebP, анимация и всё, что окно не декодирует, — как есть.
 *
 * Оригинал целиком отправляет кнопка «Файл» (тоже без метаданных).
 */
export async function prepareChatPhoto(blob: Blob): Promise<Blob> {
  const { blob: photo, shrinkable } = await cleanPhoto(blob, {
    maxWidth: CHAT_PHOTO_MAX_SIDE,
    maxHeight: CHAT_PHOTO_MAX_SIDE,
    quality: CHAT_PHOTO_QUALITY,
  })
  if (!shrinkable) return photo
  try {
    return (await shrinkPhoto(photo, shrinkable)) ?? photo
  } catch (e) {
    console.warn('[media-metadata] photo sent without shrinking', e)
    return photo
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('photo_decode_failed'))
    img.src = src
  })
}

/** Уменьшенное фото; null — уменьшать незачем, нечем или вышло не легче. */
async function shrinkPhoto(photo: Blob, kind: 'jpeg' | 'png'): Promise<Blob | null> {
  const url = URL.createObjectURL(photo)
  try {
    // Окно само поворачивает кадр по тегу EXIF: размеры и рисунок уже повёрнуты.
    const img = await loadImage(url)
    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height
    if (!width || !height) return null
    const longest = Math.max(width, height)
    if (longest <= CHAT_PHOTO_MAX_SIDE) {
      if (kind === 'png' || photo.size <= CHAT_PHOTO_REENCODE_MIN_BYTES) return null
    }
    const scale = Math.min(1, CHAT_PHOTO_MAX_SIDE / longest)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const type = kind === 'png' ? 'image/png' : 'image/jpeg'
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, kind === 'png' ? undefined : CHAT_PHOTO_QUALITY)
    )
    return out && out.size < photo.size ? out : null
  } finally {
    URL.revokeObjectURL(url)
  }
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
