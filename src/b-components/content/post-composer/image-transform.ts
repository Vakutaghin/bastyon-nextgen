/**
 * Трансформации картинок композера на стороне клиента (canvas). Работаем с
 * base64 data-URL (формат, в котором use-post-images хранит превью) → на выходе
 * снова base64. Без сети — чистая локальная операция перед загрузкой.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_load_failed'))
    img.src = src
  })
}

/** Тип вывода по исходному data-URL (png/jpeg/webp), c фолбэком на png. */
function mimeFromDataUrl(dataUrl: string): string {
  const m = /^data:(image\/[a-z+.-]+);/i.exec(dataUrl)
  return m ? m[1] : 'image/png'
}

/**
 * Поворачивает изображение на кратный 90° угол по часовой стрелке.
 * `degrees` нормализуется в {0, 90, 180, 270}.
 */
export async function rotateBase64(base64: string, degrees: number): Promise<string> {
  const deg = (((Math.round(degrees / 90) * 90) % 360) + 360) % 360
  if (deg === 0) return base64

  const img = await loadImage(base64)
  const swap = deg === 90 || deg === 270
  const canvas = document.createElement('canvas')
  canvas.width = swap ? img.height : img.width
  canvas.height = swap ? img.width : img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return base64

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)

  const mime = mimeFromDataUrl(base64)
  // Для jpeg задаём качество, чтобы не раздувать; png/webp игнорируют второй арг.
  return canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.9 : undefined)
}

/** Прямоугольник кропа в процентах (0..100) от размеров изображения. */
export interface CropPercent {
  x: number
  y: number
  w: number
  h: number
}

/** Пресет фильтра: `css` — значение CSS/canvas `filter`; `labelKey` — i18n. */
export interface FilterPreset {
  key: string
  labelKey: string
  css: string
}

export const FILTER_PRESETS: readonly FilterPreset[] = [
  { key: 'none', labelKey: 'imageEditor.filterNone', css: 'none' },
  { key: 'grayscale', labelKey: 'imageEditor.filterGrayscale', css: 'grayscale(1)' },
  { key: 'sepia', labelKey: 'imageEditor.filterSepia', css: 'sepia(0.65)' },
  { key: 'vivid', labelKey: 'imageEditor.filterVivid', css: 'saturate(1.6)' },
  {
    key: 'warm',
    labelKey: 'imageEditor.filterWarm',
    css: 'sepia(0.3) saturate(1.3) contrast(1.05)',
  },
  {
    key: 'cool',
    labelKey: 'imageEditor.filterCool',
    css: 'hue-rotate(20deg) saturate(1.1) brightness(1.05)',
  },
  { key: 'bright', labelKey: 'imageEditor.filterBright', css: 'brightness(1.18) contrast(1.05)' },
  { key: 'contrast', labelKey: 'imageEditor.filterContrast', css: 'contrast(1.35)' },
]

function clamp01to100(v: number): number {
  return Math.max(0, Math.min(100, v))
}

/**
 * Применяет кроп (в процентах) и CSS-фильтр к изображению одним canvas-проходом.
 * `crop = null` — без кропа; `filterCss = 'none'` — без фильтра.
 */
export async function applyCropFilter(
  base64: string,
  crop: CropPercent | null,
  filterCss: string
): Promise<string> {
  const noCrop = !crop || (crop.x === 0 && crop.y === 0 && crop.w === 100 && crop.h === 100)
  if (noCrop && (!filterCss || filterCss === 'none')) return base64

  const img = await loadImage(base64)
  const W = img.naturalWidth || img.width
  const H = img.naturalHeight || img.height

  const sx = crop ? (clamp01to100(crop.x) / 100) * W : 0
  const sy = crop ? (clamp01to100(crop.y) / 100) * H : 0
  const sw = crop ? Math.max(1, (clamp01to100(crop.w) / 100) * W) : W
  const sh = crop ? Math.max(1, (clamp01to100(crop.h) / 100) * H) : H

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw)
  canvas.height = Math.round(sh)
  const ctx = canvas.getContext('2d')
  if (!ctx) return base64

  if (filterCss && filterCss !== 'none') {
    // ctx.filter поддерживается современными браузерами (наш таргет — modern).
    ctx.filter = filterCss
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

  const mime = mimeFromDataUrl(base64)
  return canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.9 : undefined)
}
