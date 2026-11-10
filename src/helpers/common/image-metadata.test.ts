import { describe, expect, it } from 'vitest'

import {
  bytesToDataUrl,
  dataUrlByteLength,
  dataUrlBytes,
  exifOrientation,
  orientationOnlyExif,
  sniffImage,
  stripImageMetadata,
  stripJpegMetadata,
  stripPngMetadata,
} from './image-metadata'

// ─── Сборщики файлов ─────────────────────────────────────────────────────────

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0))

/** Сегмент JPEG: FF, маркер, длина (с самой длиной), данные. */
function seg(marker: number, data: number[]): number[] {
  const len = data.length + 2
  return [0xff, marker, len >> 8, len & 0xff, ...data]
}

/** EXIF (APP1) c IFD0: Make и, если задано, Orientation. */
function exif(orientation: number | null, little = true): number[] {
  const u16 = (v: number) => (little ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff])
  const u32 = (v: number) =>
    little
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24]
      : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]
  const entries: number[][] = [[...u16(0x010f), ...u16(2), ...u32(4), ...ascii('GPS!')]]
  if (orientation !== null) {
    entries.push([...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0])
  }
  return [
    ...ascii('Exif\0\0'),
    ...(little ? ascii('II') : ascii('MM')),
    ...u16(42),
    ...u32(8),
    ...u16(entries.length),
    ...entries.flat(),
    ...u32(0),
  ]
}

const SOI = [0xff, 0xd8]
const EOI = [0xff, 0xd9]
const JFIF = seg(0xe0, [...ascii('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0])
const ICC = seg(0xe2, [...ascii('ICC_PROFILE\0'), 1, 1, 9, 9, 9])
const MPF = seg(0xe2, [...ascii('MPF\0'), 7, 7, 7])
const XMP = seg(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/\0'), ...ascii('<gps/>')])
const IPTC = seg(0xed, [...ascii('Photoshop 3.0\0'), 5, 5])
const VENDOR = seg(0xeb, [1, 2, 3])
const ADOBE = seg(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1])
const COM = seg(0xfe, ascii('shot on my phone'))
const DQT = seg(0xdb, [0, ...Array(64).fill(1)])
const SOF = seg(0xc0, [8, 0, 2, 0, 2, 1, 1, 0x11, 0])
const DHT = seg(0xc4, [0, ...Array(16).fill(0)])
const SOS = seg(0xda, [1, 1, 0, 0, 0x3f, 0])
/** Сжатые данные с экранированным FF00 и маркером рестарта. */
const SCAN = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xff, 0x00, 0x78]

function jpeg(...segments: number[][]): Uint8Array {
  return Uint8Array.from([...SOI, ...segments.flat()])
}

const contains = (hay: Uint8Array, needle: number[]): boolean => {
  outer: for (let i = 0; i + needle.length <= hay.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (hay[i + j] !== needle[j]) continue outer
    return true
  }
  return false
}

function chunk(type: string, data: number[] = []): number[] {
  const len = data.length
  return [
    len >>> 24,
    (len >> 16) & 0xff,
    (len >> 8) & 0xff,
    len & 0xff,
    ...ascii(type),
    ...data,
    0,
    0,
    0,
    0,
  ]
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const IHDR = chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
const IDAT = chunk('IDAT', [1, 2, 3, 4])
const IEND = chunk('IEND')

function png(...chunks: number[][]): Uint8Array {
  return Uint8Array.from([...PNG_SIG, ...chunks.flat()])
}

// ─── Тесты ───────────────────────────────────────────────────────────────────

describe('sniffImage', () => {
  it('JPEG и PNG по сигнатуре, остальное — other', () => {
    expect(sniffImage(jpeg(EOI))).toBe('jpeg')
    expect(sniffImage(png(IEND))).toBe('png')
    expect(sniffImage(Uint8Array.from(ascii('RIFF....WEBP')))).toBe('other')
    expect(sniffImage(new Uint8Array())).toBe('other')
  })
})

describe('exifOrientation', () => {
  const at = (app1: number[]) => {
    const bytes = Uint8Array.from(app1)
    return exifOrientation(bytes, 0, bytes.length)
  }

  it('читает тег в обоих порядках байтов', () => {
    expect(at(exif(6, true))).toBe(6)
    expect(at(exif(8, false))).toBe(8)
  })

  it('нет тега — 1; не EXIF (XMP) — 1', () => {
    expect(at(exif(null))).toBe(1)
    expect(at(ascii('http://ns.adobe.com/xap/1.0/\0'))).toBe(1)
  })

  it('испорченный TIFF — null', () => {
    const broken = exif(1)
    broken[6] = 0x58 // не II и не MM
    expect(at(broken)).toBeNull()
    const wrongMagic = exif(1)
    wrongMagic[8] = 43
    expect(at(wrongMagic)).toBeNull()
    // IFD указывает за конец сегмента.
    expect(at(exif(1).slice(0, 18))).toBeNull()
  })
})

describe('stripJpegMetadata', () => {
  it('убирает EXIF, XMP, IPTC, MPF, комментарии и данные производителя', () => {
    const src = jpeg(
      JFIF,
      seg(0xe1, exif(1)),
      XMP,
      ICC,
      MPF,
      IPTC,
      VENDOR,
      ADOBE,
      COM,
      DQT,
      SOF,
      DHT,
      SOS,
      SCAN,
      EOI
    )
    const out = stripJpegMetadata(src)!
    expect(Array.from(out)).toEqual([
      ...SOI,
      ...JFIF,
      ...ICC,
      ...ADOBE,
      ...DQT,
      ...SOF,
      ...DHT,
      ...SOS,
      ...SCAN,
      ...EOI,
    ])
    expect(contains(out, ascii('GPS!'))).toBe(false)
    expect(contains(out, ascii('<gps/>'))).toBe(false)
    expect(contains(out, ascii('shot on my phone'))).toBe(false)
  })

  it('после конца картинки (видео «живого фото», второй кадр MPF) — отрезается', () => {
    const src = Uint8Array.from([...jpeg(DQT, SOS, SCAN, EOI), ...ascii('ftypmp42 video')])
    expect(Array.from(stripJpegMetadata(src)!)).toEqual([...SOI, ...DQT, ...SOS, ...SCAN, ...EOI])
  })

  it('прогрессивный JPEG: несколько сканов с таблицами между ними', () => {
    const src = jpeg(SOF, DHT, SOS, SCAN, DHT, SOS, [0x9a, 0xff, 0x00], COM, SOS, [0x01], EOI)
    expect(Array.from(stripJpegMetadata(src)!)).toEqual([
      ...SOI,
      ...SOF,
      ...DHT,
      ...SOS,
      ...SCAN,
      ...DHT,
      ...SOS,
      0x9a,
      0xff,
      0x00,
      ...SOS,
      0x01,
      ...EOI,
    ])
  })

  it('EXIF поворачивает кадр — null: без него фото ляжет на бок', () => {
    expect(stripJpegMetadata(jpeg(seg(0xe1, exif(6)), DQT, SOS, SCAN, EOI))).toBeNull()
    expect(stripJpegMetadata(jpeg(seg(0xe1, exif(3, false)), DQT, SOS, SCAN, EOI))).toBeNull()
    // Крайние значения поворота.
    expect(stripJpegMetadata(jpeg(seg(0xe1, exif(2)), DQT, SOS, SCAN, EOI))).toBeNull()
    expect(stripJpegMetadata(jpeg(seg(0xe1, exif(8)), DQT, SOS, SCAN, EOI))).toBeNull()
  })

  it('keepOrientation: вместо EXIF — один тег поворота, остальное как без него', () => {
    const src = jpeg(JFIF, seg(0xe1, exif(6)), XMP, ICC, DQT, SOS, SCAN, EOI, [0xaa])
    const out = stripJpegMetadata(src, { keepOrientation: true })!
    expect(Array.from(out)).toEqual([
      ...SOI,
      ...JFIF,
      ...orientationOnlyExif(6),
      ...ICC,
      ...DQT,
      ...SOS,
      ...SCAN,
      ...EOI,
    ])
    expect(contains(out, ascii('GPS!'))).toBe(false)
    // Обратно читается тем же разбором, что у браузера: поворот на месте.
    expect(exifOrientation(out, 2 + JFIF.length + 4, out.length)).toBe(6)
  })

  it('keepOrientation: порядок байтов исходника не важен; без поворота EXIF уходит целиком', () => {
    const turned = stripJpegMetadata(jpeg(seg(0xe1, exif(3, false)), DQT, SOS, SCAN, EOI), {
      keepOrientation: true,
    })!
    expect(exifOrientation(turned, 6, turned.length)).toBe(3)
    const straight = stripJpegMetadata(jpeg(seg(0xe1, exif(1)), DQT, SOS, SCAN, EOI), {
      keepOrientation: true,
    })!
    expect(Array.from(straight)).toEqual([...SOI, ...DQT, ...SOS, ...SCAN, ...EOI])
  })

  it('минимальный EXIF: 36 байт, длина сегмента сходится, кроме поворота ничего', () => {
    const app1 = orientationOnlyExif(8)
    expect(app1).toHaveLength(36)
    expect((app1[2]! << 8) | app1[3]!).toBe(app1.length - 2)
    expect(exifOrientation(app1, 4, app1.length)).toBe(8)
    // В IFD0 ровно один тег.
    expect((app1[18]! << 8) | app1[19]!).toBe(1)
  })

  it('поворот вне 2…8 браузер не применяет — EXIF вырезается и без keepOrientation', () => {
    for (const value of [0, 9]) {
      const out = stripJpegMetadata(jpeg(seg(0xe1, exif(value)), DQT, SOS, SCAN, EOI))!
      expect(Array.from(out)).toEqual([...SOI, ...DQT, ...SOS, ...SCAN, ...EOI])
    }
  })

  it('EXIF не читается — null (не знаем, повёрнут ли кадр)', () => {
    const broken = exif(1)
    broken[6] = 0
    expect(stripJpegMetadata(jpeg(seg(0xe1, broken), SOS, SCAN, EOI))).toBeNull()
    expect(
      stripJpegMetadata(jpeg(seg(0xe1, broken), SOS, SCAN, EOI), { keepOrientation: true })
    ).toBeNull()
  })

  it('обрезанный или битый файл — null', () => {
    // Нет EOI: обрыв посреди скана и ровно между сегментами.
    expect(stripJpegMetadata(jpeg(DQT, SOS, SCAN))).toBeNull()
    expect(stripJpegMetadata(jpeg(JFIF, DQT))).toBeNull()
    // Длина сегмента за концом файла.
    expect(stripJpegMetadata(Uint8Array.from([...SOI, 0xff, 0xdb, 0x10, 0x00, 1, 2]))).toBeNull()
    // Мусор вместо маркера.
    expect(stripJpegMetadata(Uint8Array.from([...SOI, 0x00, 0x01]))).toBeNull()
    // Длина меньше двух.
    expect(stripJpegMetadata(Uint8Array.from([...SOI, 0xff, 0xdb, 0x00, 0x01, ...EOI]))).toBeNull()
    // Файл кончается на маркере.
    expect(stripJpegMetadata(Uint8Array.from([...SOI, 0xff, 0xff]))).toBeNull()
    // Не JPEG.
    expect(stripJpegMetadata(png(IEND))).toBeNull()
  })

  it('маркеры без длины до скана копируются', () => {
    const src = jpeg([0xff, 0x01], DQT, SOS, SCAN, EOI)
    expect(Array.from(stripJpegMetadata(src)!)).toEqual([
      ...SOI,
      0xff,
      0x01,
      ...DQT,
      ...SOS,
      ...SCAN,
      ...EOI,
    ])
  })
})

describe('stripPngMetadata', () => {
  it('убирает eXIf, текстовые чанки и время; картинку, прозрачность и профиль оставляет', () => {
    const tRNS = chunk('tRNS', [0, 0])
    const iCCP = chunk('iCCP', [...ascii('icc\0'), 0, 9])
    const src = png(
      IHDR,
      chunk('eXIf', ascii('GPS!')),
      iCCP,
      chunk('tEXt', ascii('Author\0me')),
      chunk('iTXt', ascii('XML:com.adobe.xmp\0<gps/>')),
      chunk('zTXt', [1, 2]),
      chunk('tIME', [7, 7, 7, 7, 7, 7, 7]),
      tRNS,
      IDAT,
      IEND
    )
    const out = stripPngMetadata(src)!
    expect(out.animated).toBe(false)
    expect(Array.from(out.bytes)).toEqual([...PNG_SIG, ...IHDR, ...iCCP, ...tRNS, ...IDAT, ...IEND])
  })

  it('APNG (acTL) — animated', () => {
    const out = stripPngMetadata(png(IHDR, chunk('acTL', [0, 0, 0, 2, 0, 0, 0, 0]), IDAT, IEND))!
    expect(out.animated).toBe(true)
  })

  it('после IEND — отрезается; без IEND или с обрезанным чанком — null', () => {
    const tail = Uint8Array.from([...png(IHDR, IDAT, IEND), 1, 2, 3])
    expect(Array.from(stripPngMetadata(tail)!.bytes)).toEqual([
      ...PNG_SIG,
      ...IHDR,
      ...IDAT,
      ...IEND,
    ])
    expect(stripPngMetadata(png(IHDR, IDAT))).toBeNull()
    expect(stripPngMetadata(png(IHDR, IDAT.slice(0, 10)))).toBeNull()
    expect(stripPngMetadata(jpeg(EOI))).toBeNull()
  })
})

describe('data-URL', () => {
  it('байты из base64, начало для сниффинга, не base64 — null', () => {
    expect(Array.from(dataUrlBytes('data:image/png;base64,AQID')!)).toEqual([1, 2, 3])
    expect(Array.from(dataUrlBytes('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ', 3)!)).toEqual([
      0xff, 0xd8, 0xff,
    ])
    expect(dataUrlBytes('data:image/svg+xml,<svg/>')).toBeNull()
    expect(dataUrlBytes('no comma')).toBeNull()
    expect(dataUrlBytes('data:image/png;base64,***')).toBeNull()
  })

  it('большой файл туда и обратно (кусками больше 32 КБ)', () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 7) % 256)
    const url = bytesToDataUrl(bytes, 'image/png')
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    expect(dataUrlByteLength(url)).toBe(100_000)
    expect(dataUrlBytes(url)).toEqual(bytes)
  })

  it('размер учитывает выравнивание base64', () => {
    expect(dataUrlByteLength('data:x;base64,AQID')).toBe(3)
    expect(dataUrlByteLength('data:x;base64,AQI=')).toBe(2)
    expect(dataUrlByteLength('data:x;base64,AQ==')).toBe(1)
  })
})

describe('stripImageMetadata', () => {
  it('JPEG и PNG — тем же форматом без метаданных', () => {
    const j = stripImageMetadata(
      bytesToDataUrl(jpeg(seg(0xe1, exif(1)), DQT, SOS, SCAN, EOI), 'image/jpeg')
    )!
    expect(j.animated).toBe(false)
    expect(j.dataUrl).toBe(bytesToDataUrl(jpeg(DQT, SOS, SCAN, EOI), 'image/jpeg'))

    // Префикс data-URL неверный (файл без типа) — формат решают байты.
    const p = stripImageMetadata(
      bytesToDataUrl(png(IHDR, chunk('tEXt', [1]), IDAT, IEND), 'image/jpeg')
    )!
    expect(p.dataUrl).toBe(bytesToDataUrl(png(IHDR, IDAT, IEND), 'image/png'))
  })

  it('другой формат, битый файл или повёрнутый JPEG — null', () => {
    expect(
      stripImageMetadata(bytesToDataUrl(Uint8Array.from(ascii('RIFF....WEBP')), 'image/webp'))
    ).toBeNull()
    expect(stripImageMetadata(bytesToDataUrl(png(IHDR), 'image/png'))).toBeNull()
    expect(
      stripImageMetadata(bytesToDataUrl(jpeg(seg(0xe1, exif(6)), SOS, SCAN, EOI), 'image/jpeg'))
    ).toBeNull()
    expect(stripImageMetadata('data:image/png;base64,***')).toBeNull()
  })
})
