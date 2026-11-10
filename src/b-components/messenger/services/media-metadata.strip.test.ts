// Фото перед отправкой в чат: метаданные вырезаются из байтов JPEG и PNG без
// перекодирования; битый JPEG/PNG перерисовывается (canvas подменён), прочие
// форматы уходят как есть.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const resize = vi.hoisted(() => ({
  /** Что вернёт перерисовка: строка — data-URL, 'source' — исходник, Error — отказ. */
  result: 'data:image/jpeg;base64,/9j/2Q==' as string | Error,
  calls: [] as { source: string; options: unknown }[],
}))

vi.mock('@/helpers/common/resize-image', () => ({
  // Исходник — сам по себе JPEG по сигнатуре: вернувшийся как есть не должен сойти за перерисовку.
  fileToBase64: vi.fn(async () => 'data:image/jpeg;base64,/9j/AA=='),
  resizeImageBase64: vi.fn(async (source: string, options: unknown) => {
    resize.calls.push({ source, options })
    if (resize.result instanceof Error) throw resize.result
    return resize.result === 'source' ? source : resize.result
  }),
}))

import { stripPhotoMetadata } from './media-metadata'

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0))

function seg(marker: number, data: number[]): number[] {
  const len = data.length + 2
  return [0xff, marker, len >> 8, len & 0xff, ...data]
}

/** EXIF (II) c GPS-подобной строкой и поворотом. */
function exif(orientation: number): number[] {
  return [
    ...ascii('Exif\0\0II'),
    42,
    0,
    8,
    0,
    0,
    0,
    2,
    0,
    ...[0x0f, 0x01, 2, 0, 4, 0, 0, 0, ...ascii('GPS!')],
    ...[0x12, 0x01, 3, 0, 1, 0, 0, 0, orientation, 0, 0, 0],
    0,
    0,
    0,
    0,
  ]
}

const SOI = [0xff, 0xd8]
const EOI = [0xff, 0xd9]
const DQT = seg(0xdb, [0, 1, 1, 1])
const SOS = seg(0xda, [1, 1, 0, 0, 0x3f, 0])
const SCAN = [0x12, 0x34]

function chunk(type: string, data: number[] = []): number[] {
  return [0, 0, 0, data.length, ...ascii(type), ...data, 0, 0, 0, 0]
}
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const bytesOf = async (blob: Blob): Promise<number[]> =>
  Array.from(new Uint8Array(await blob.arrayBuffer()))

const contains = (hay: number[], needle: number[]): boolean =>
  hay.some((_, i) => needle.every((b, j) => hay[i + j] === b))

beforeEach(() => {
  resize.result = 'data:image/jpeg;base64,/9j/2Q=='
  resize.calls.length = 0
  vi.restoreAllMocks()
})

describe('stripPhotoMetadata', () => {
  it('JPEG с телефона: без места съёмки, тот же кадр, поворот на месте', async () => {
    const photo = new Blob(
      [Uint8Array.from([...SOI, ...seg(0xe1, exif(6)), ...DQT, ...SOS, ...SCAN, ...EOI])],
      {
        type: 'image/jpeg',
      }
    )
    const out = await stripPhotoMetadata(photo)
    const bytes = await bytesOf(out)
    expect(out.type).toBe('image/jpeg')
    expect(contains(bytes, ascii('GPS!'))).toBe(false)
    // Минимальный EXIF с поворотом 6 и нетронутые данные картинки.
    expect(contains(bytes, [0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 6])).toBe(true)
    expect(contains(bytes, [...DQT, ...SOS, ...SCAN, ...EOI])).toBe(true)
    expect(resize.calls).toHaveLength(0)
  })

  it('PNG без типа (файл из облака) — тип по байтам, текстовые чанки вырезаны', async () => {
    const IHDR = chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
    const src = [
      ...PNG_SIG,
      ...IHDR,
      ...chunk('iTXt', ascii('XML:com.adobe.xmp<gps/>')),
      ...chunk('IDAT', [1, 2]),
      ...chunk('IEND'),
    ]
    const out = await stripPhotoMetadata(new Blob([Uint8Array.from(src)]))
    expect(out.type).toBe('image/png')
    expect(await bytesOf(out)).toEqual([
      ...PNG_SIG,
      ...IHDR,
      ...chunk('IDAT', [1, 2]),
      ...chunk('IEND'),
    ])
  })

  it('GIF, WebP, HEIC — тот же файл: canvas убил бы анимацию', async () => {
    for (const head of ['GIF89a', 'RIFF\0\0\0\0WEBP', '\0\0\0\x18ftypheic']) {
      const file = new Blob([Uint8Array.from(ascii(head))], { type: 'image/x' })
      expect(await stripPhotoMetadata(file)).toBe(file)
    }
    expect(resize.calls).toHaveLength(0)
  })

  it('битый JPEG — перерисовка не больше 4096 по стороне', async () => {
    const broken = new Blob([
      Uint8Array.from([...SOI, ...seg(0xe1, exif(1)), ...DQT, ...SOS, ...SCAN]),
    ])
    const out = await stripPhotoMetadata(broken)
    expect(resize.calls).toEqual([
      { source: 'data:image/jpeg;base64,/9j/AA==', options: { maxWidth: 4096, maxHeight: 4096 } },
    ])
    expect(out.type).toBe('image/jpeg')
    expect(await bytesOf(out)).toEqual([0xff, 0xd8, 0xff, 0xd9])
  })

  it('битый PNG, а canvas отдал PNG (прозрачность) — тип PNG', async () => {
    resize.result = `data:image/png;base64,${btoa(String.fromCharCode(...PNG_SIG))}`
    const out = await stripPhotoMetadata(new Blob([Uint8Array.from([...PNG_SIG, 0, 0])]))
    expect(out.type).toBe('image/png')
  })

  it('перерисовать не вышло — уходит как был, с предупреждением', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken = new Blob([Uint8Array.from([...SOI, 0xff, 0x00])])
    for (const result of [new Error('decode'), 'source', 'data:text/plain;base64,QUJD']) {
      resize.result = result
      expect(await stripPhotoMetadata(broken)).toBe(broken)
    }
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it('файл не читается — тот же файл', async () => {
    const file = new Blob(['x'])
    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('NotReadableError'))
    expect(await stripPhotoMetadata(file)).toBe(file)
  })
})
