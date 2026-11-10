/**
 * Метаданные картинки без перекодирования: вырезаются из байтов JPEG и PNG.
 *
 * Зачем: маленькую картинку, уже сжатую лучше, чем это сделает canvas, выгоднее
 * загрузить как есть. Но в оригинале лежит EXIF — у фото с телефона там место
 * съёмки (GPS), модель, время. Перекодирование через canvas всё это стирало;
 * загружая оригинал, стираем сами.
 *
 * JPEG: убираются APP1 (EXIF, XMP), APP13 (IPTC), комментарии, служебные APPn
 * производителей и всё после конца картинки (у «живых фото» Samsung и
 * MPF-снимков там второе изображение или видео). Остаются JFIF (APP0),
 * цветовой профиль (APP2 ICC) и Adobe (APP14) — без них цвета или декодирование
 * поедут. Если EXIF поворачивает кадр (Orientation ≠ 1), вырезать его нельзя —
 * фото ляжет на бок; тогда `null`, и вызывающий берёт перекодированный кадр
 * (canvas уже рисует его повёрнутым).
 *
 * PNG: убираются eXIf, текстовые чанки (tEXt/zTXt/iTXt — в них бывает XMP с
 * GPS) и tIME, а также всё после IEND.
 *
 * Битый или незнакомый файл — `null`: лучше перекодировать, чем отдать
 * непроверенные байты.
 */

export type SniffedImage = 'jpeg' | 'png' | 'other'

export function sniffImage(bytes: Uint8Array): SniffedImage {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png'
  }
  return 'other'
}

// ─── JPEG ────────────────────────────────────────────────────────────────────

const SOI = 0xd8
const EOI = 0xd9
const SOS = 0xda
const APP0 = 0xe0
const APP1 = 0xe1
const APP2 = 0xe2
const APP14 = 0xee
const COM = 0xfe

function startsWithAscii(bytes: Uint8Array, at: number, text: string): boolean {
  if (at + text.length > bytes.length) return false
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[at + i] !== text.charCodeAt(i)) return false
  }
  return true
}

/**
 * Orientation из EXIF (тег 0x0112 в IFD0). `start` — начало данных APP1
 * (сразу после длины). Нет тега — 1; EXIF не читается — `null`.
 */
export function exifOrientation(bytes: Uint8Array, start: number, end: number): number | null {
  if (!startsWithAscii(bytes, start, 'Exif\0\0')) return 1
  const tiff = start + 6
  if (tiff + 8 > end) return null
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49
  const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d
  if (!little && !big) return null
  const u16 = (at: number): number =>
    little ? bytes[at]! | (bytes[at + 1]! << 8) : (bytes[at]! << 8) | bytes[at + 1]!
  const u32 = (at: number): number =>
    little
      ? (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0
      : ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0
  if (u16(tiff + 2) !== 42) return null
  const ifd = tiff + u32(tiff + 4)
  if (ifd + 2 > end) return null
  const count = u16(ifd)
  if (ifd + 2 + count * 12 > end) return null
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12
    if (u16(entry) === 0x0112) return u16(entry + 8)
  }
  return 1
}

/** Сегмент APPn/COM, который уходит из файла. */
function dropsSegment(bytes: Uint8Array, marker: number, dataStart: number): boolean {
  if (marker === COM) return true
  if (marker === APP0 || marker === APP14) return false
  // APP2 — это и цветовой профиль (оставляем), и MPF со ссылками на второй кадр.
  if (marker === APP2) return !startsWithAscii(bytes, dataStart, 'ICC_PROFILE\0')
  return marker >= APP1 && marker <= 0xef
}

/**
 * JPEG без метаданных. `null` — файл битый или EXIF поворачивает кадр.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  if (sniffImage(bytes) !== 'jpeg') return null
  const parts: Uint8Array[] = [bytes.subarray(0, 2)]
  let pos = 2
  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) return null
    const markerAt = pos
    while (pos < bytes.length && bytes[pos] === 0xff) pos += 1
    if (pos >= bytes.length) return null
    const marker = bytes[pos]!
    pos += 1
    if (marker === EOI) {
      parts.push(bytes.subarray(markerAt, pos))
      return concat(parts)
    }
    // Маркеры без длины (RSTn, TEM, повторный SOI) до SOS — копируем как есть.
    if (marker === SOI || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(markerAt, pos))
      continue
    }
    if (pos + 2 > bytes.length) return null
    const length = (bytes[pos]! << 8) | bytes[pos + 1]!
    if (length < 2 || pos + length > bytes.length) return null
    const dataStart = pos + 2
    const segmentEnd = pos + length
    if (marker === APP1) {
      const orientation = exifOrientation(bytes, dataStart, segmentEnd)
      if (orientation !== 1) return null
    }
    if (!dropsSegment(bytes, marker, dataStart)) parts.push(bytes.subarray(markerAt, segmentEnd))
    pos = segmentEnd
    if (marker !== SOS) continue
    // Сжатые данные скана: 0xFF в них — это FF00 (экранирование) или RSTn;
    // любой другой маркер завершает скан (следующий скан, таблицы или EOI).
    let scan = pos
    while (scan + 1 < bytes.length) {
      if (bytes[scan] !== 0xff) {
        scan += 1
        continue
      }
      const next = bytes[scan + 1]!
      if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
        scan += 2
        continue
      }
      if (next === 0xff) {
        scan += 1
        continue
      }
      break
    }
    if (scan + 1 >= bytes.length) return null
    parts.push(bytes.subarray(pos, scan))
    pos = scan
  }
  // Конца картинки (EOI) нет — файл обрезан.
  return null
}

// ─── PNG ─────────────────────────────────────────────────────────────────────

const PNG_DROPPED_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])

/**
 * PNG без метаданных; `animated` — это APNG (есть acTL): такой файл, как GIF,
 * нельзя перерисовывать через canvas, анимация пропадёт. `null` — файл битый.
 */
export function stripPngMetadata(
  bytes: Uint8Array
): { bytes: Uint8Array; animated: boolean } | null {
  if (sniffImage(bytes) !== 'png') return null
  const parts: Uint8Array[] = [bytes.subarray(0, 8)]
  let animated = false
  let pos = 8
  while (pos + 12 <= bytes.length) {
    const length =
      ((bytes[pos]! << 24) | (bytes[pos + 1]! << 16) | (bytes[pos + 2]! << 8) | bytes[pos + 3]!) >>>
      0
    const end = pos + 12 + length
    if (end > bytes.length) return null
    const type = String.fromCharCode(
      bytes[pos + 4]!,
      bytes[pos + 5]!,
      bytes[pos + 6]!,
      bytes[pos + 7]!
    )
    if (type === 'acTL') animated = true
    if (!PNG_DROPPED_CHUNKS.has(type)) parts.push(bytes.subarray(pos, end))
    pos = end
    if (type === 'IEND') return { bytes: concat(parts), animated }
  }
  return null
}

// ─── data-URL ────────────────────────────────────────────────────────────────

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Байты из data-URL (base64); не base64 или битый base64 — `null`. */
export function dataUrlBytes(dataUrl: string, limit?: number): Uint8Array | null {
  const comma = dataUrl.indexOf(',')
  if (comma < 0 || !dataUrl.slice(0, comma).endsWith(';base64')) return null
  let b64 = dataUrl.slice(comma + 1)
  // Для сниффинга хватает начала: 16 символов base64 — 12 байт.
  if (limit !== undefined) b64 = b64.slice(0, Math.ceil(limit / 3) * 4)
  let bin: string
  try {
    bin = atob(b64)
  } catch {
    return null
  }
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = ''
  // По кускам: String.fromCharCode с миллионом аргументов переполняет стек.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:${mime};base64,${btoa(bin)}`
}

/** Сколько байт в data-URL (по длине base64, без декодирования). */
export function dataUrlByteLength(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

/**
 * Оригинал без метаданных — тем же data-URL. `null` — формат не JPEG/PNG,
 * файл битый или JPEG повёрнут через EXIF.
 */
export function stripImageMetadata(dataUrl: string): { dataUrl: string; animated: boolean } | null {
  const bytes = dataUrlBytes(dataUrl)
  if (!bytes) return null
  const kind = sniffImage(bytes)
  if (kind === 'jpeg') {
    const out = stripJpegMetadata(bytes)
    return out ? { dataUrl: bytesToDataUrl(out, 'image/jpeg'), animated: false } : null
  }
  if (kind === 'png') {
    const out = stripPngMetadata(bytes)
    return out ? { dataUrl: bytesToDataUrl(out.bytes, 'image/png'), animated: out.animated } : null
  }
  return null
}
