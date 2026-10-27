/**
 * Кадры из выбранного видеофайла — для обложки. Файл открывается здесь же, в
 * окне (<video> на blob:), кадр рисуется на canvas и сохраняется в JPEG. Сеть не
 * нужна: обложка готова раньше, чем видео догрузится.
 *
 * Окно, которое не декодирует файл (H.264 на Linux без кодека, HEVC в Chrome
 * на Windows), кадра не даст. Тогда обложку выбирает видеосервер сам, а человек
 * может загрузить свою картинку.
 */

/** Длинная сторона обложки: видеосерверу больше не нужно (его превью 850×480). */
export const COVER_MAX_SIDE = 1280
/** Длинная сторона кадров в ленте выбора. */
export const STRIP_MAX_SIDE = 160
const JPEG_QUALITY = 0.9
/** Сколько ждать, пока окно откроет файл. */
const LOAD_TIMEOUT_MS = 10_000
/** Сколько ждать перемотки на кадр. */
const SEEK_TIMEOUT_MS = 5_000
/**
 * Первый кадр берём чуть после нуля: перемотка на ту же позицию, где видео уже
 * стоит, в WebKit может не закончиться событием, а кадр от этого не меняется.
 */
const FIRST_FRAME_TIME = 0.001

/** Окно умеет рисовать кадры: в тестовой среде canvas нет. */
export function canCaptureFrames(): boolean {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return false
  try {
    return !!document.createElement('canvas').getContext('2d')
  } catch {
    return false
  }
}

function waitForEvent(media: HTMLMediaElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error): void => {
      clearTimeout(timer)
      media.removeEventListener(event, onEvent)
      media.removeEventListener('error', onError)
      if (error) reject(error)
      else resolve()
    }
    const onEvent = (): void => finish()
    const onError = (): void => finish(new Error('video_frame_decode'))
    const timer = setTimeout(() => finish(new Error('video_frame_timeout')), timeoutMs)
    media.addEventListener(event, onEvent)
    media.addEventListener('error', onError)
  })
}

/** Перемотать на `time` (секунды) и дождаться кадра. */
export async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0
  const target = Math.max(FIRST_FRAME_TIME, duration ? Math.min(time, duration - 0.05) : time)
  const seeked = waitForEvent(video, 'seeked', SEEK_TIMEOUT_MS)
  video.currentTime = target
  await seeked
}

/** Ширина и высота, вписанные в `maxSide` по длинной стороне. */
export function fitSize(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('video_frame_encode'))),
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

/** Текущий кадр видео в JPEG. */
export function drawFrame(video: HTMLVideoElement, maxSide = COVER_MAX_SIDE): Promise<Blob> {
  const { width, height } = fitSize(video.videoWidth, video.videoHeight, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('video_frame_canvas'))
  ctx.drawImage(video, 0, 0, width, height)
  return canvasToJpeg(canvas)
}

/** Открытый для кадров файл: перемотки идут по очереди, иначе кадры путаются. */
export interface FrameSource {
  /** Длительность, с; 0 — окно её не знает (так бывает у записей WebM). */
  duration: number
  width: number
  height: number
  frameAt(time: number, maxSide?: number): Promise<Blob>
  close(): void
}

/** Открыть файл для кадров; null — окно его не показывает или в нём нет видео. */
export async function openFrameSource(file: Blob): Promise<FrameSource | null> {
  if (!canCaptureFrames()) return null
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  const close = (): void => {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
  try {
    const loaded = waitForEvent(video, 'loadedmetadata', LOAD_TIMEOUT_MS)
    video.src = url
    await loaded
  } catch {
    close()
    return null
  }
  // Звук или файл без картинки.
  if (!video.videoWidth || !video.videoHeight) {
    close()
    return null
  }

  let queue: Promise<unknown> = Promise.resolve()
  const frameAt = (time: number, maxSide = COVER_MAX_SIDE): Promise<Blob> => {
    const next = queue.then(async () => {
      await seekTo(video, time)
      return drawFrame(video, maxSide)
    })
    queue = next.catch(() => {})
    return next
  }

  return {
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    width: video.videoWidth,
    height: video.videoHeight,
    frameAt,
    close,
  }
}

/** Первый кадр файла — обложка по умолчанию; null — кадра не взять. */
export async function firstFrame(file: Blob): Promise<Blob | null> {
  const source = await openFrameSource(file)
  if (!source) return null
  try {
    return await source.frameAt(0)
  } catch {
    return null
  } finally {
    source.close()
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('cover_image_decode'))
    img.src = url
  }).finally(() => URL.revokeObjectURL(url))
}

/**
 * Своя картинка → обложка: обрезана по центру под формат ролика (`aspect` =
 * ширина / высота; null — не обрезать) и уменьшена. Иначе превью в ленте
 * прыгало бы по размеру, когда начинается видео.
 */
export async function coverFromImage(file: Blob, aspect: number | null): Promise<Blob> {
  const img = await loadImage(file)
  let sx = 0
  let sy = 0
  let sw = img.naturalWidth
  let sh = img.naturalHeight
  if (!sw || !sh) throw new Error('cover_image_decode')
  if (aspect && aspect > 0) {
    if (sw / sh > aspect) {
      const width = Math.round(sh * aspect)
      sx = Math.round((sw - width) / 2)
      sw = width
    } else {
      const height = Math.round(sw / aspect)
      sy = Math.round((sh - height) / 2)
      sh = height
    }
  }
  const { width, height } = fitSize(sw, sh, COVER_MAX_SIDE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('video_frame_canvas')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
  return canvasToJpeg(canvas)
}

/** Время, где брать кадры ленты выбора: первый кадр и дальше поровну. */
export function stripTimes(duration: number, count: number): number[] {
  if (!(duration > 0) || count < 1) return [0]
  const step = duration / count
  return Array.from({ length: count }, (_, i) => i * step)
}
