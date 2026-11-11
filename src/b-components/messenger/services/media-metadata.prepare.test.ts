// Фото для чата: без метаданных и не больше 2048 px по длинной стороне.
// Декодер и canvas подменены (canvas-fakes): «картинка» грузится по размерам
// из реестра, toBlob отдаёт Blob заданного размера.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installCanvasFakes, type CanvasFakes } from '@/helpers/common/testing/canvas-fakes'

const resize = vi.hoisted(() => ({
  calls: [] as { source: string; options: unknown }[],
}))

vi.mock('@/helpers/common/resize-image', () => ({
  fileToBase64: vi.fn(async () => 'data:image/jpeg;base64,/9j/AA=='),
  // Перерисовка битого файла: JPEG из четырёх байт.
  resizeImageBase64: vi.fn(async (source: string, options: unknown) => {
    resize.calls.push({ source, options })
    return 'data:image/jpeg;base64,/9j/2Q=='
  }),
}))

import {
  CHAT_PHOTO_QUALITY,
  CHAT_PHOTO_REENCODE_MIN_BYTES,
  prepareChatPhoto,
  stripPhotoMetadata,
} from './media-metadata'

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0))

function seg(marker: number, data: number[]): number[] {
  const len = data.length + 2
  return [0xff, marker, len >> 8, len & 0xff, ...data]
}

/** EXIF (II) с «GPS!» в Make и поворотом 1. */
const EXIF = [
  ...ascii('Exif'),
  0,
  0,
  ...ascii('II'),
  ...[42, 0, 8, 0, 0, 0, 2, 0],
  ...[0x0f, 0x01, 2, 0, 4, 0, 0, 0, ...ascii('GPS!')],
  ...[0x12, 0x01, 3, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  ...[0, 0, 0, 0],
]

/** JPEG с телефона: EXIF с местом съёмки и `scanBytes` байт данных картинки. */
function phoneJpeg(scanBytes: number): Blob {
  const scan = new Uint8Array(scanBytes).fill(0x12)
  const head = Uint8Array.from([
    0xff,
    0xd8,
    ...seg(0xe1, EXIF),
    ...seg(0xdb, [0, 1, 1, 1]),
    ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]),
  ])
  return new Blob([head, scan, Uint8Array.from([0xff, 0xd9])], { type: 'image/jpeg' })
}

function chunk(type: string, data: number[] = []): number[] {
  const n = data.length
  return [
    n >>> 24,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
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

function png(extra: number[] = [], idatBytes = 2000): Blob {
  const idat = chunk('IDAT', new Array<number>(idatBytes).fill(7))
  return new Blob([Uint8Array.from([...PNG_SIG, ...IHDR, ...extra, ...idat, ...chunk('IEND')])])
}

const bytesOf = async (blob: Blob): Promise<number[]> =>
  Array.from(new Uint8Array(await blob.arrayBuffer()))

const contains = (hay: number[], needle: number[]): boolean =>
  hay.some((_, i) => needle.every((b, j) => hay[i + j] === b))

const URL_OF_PHOTO = 'blob:photo'
let fakes: CanvasFakes
const realCreate = URL.createObjectURL
const realRevoke = URL.revokeObjectURL

beforeEach(() => {
  resize.calls.length = 0
  fakes = installCanvasFakes()
  URL.createObjectURL = vi.fn(() => URL_OF_PHOTO)
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  fakes.restore()
  URL.createObjectURL = realCreate
  URL.revokeObjectURL = realRevoke
  vi.restoreAllMocks()
})

describe('prepareChatPhoto', () => {
  it('снимок 4000×3000 — 2048×1536, JPEG с качеством 0.85, место съёмки не уходит', async () => {
    fakes.sizes.set(URL_OF_PHOTO, { width: 4000, height: 3000 })
    fakes.blobSize = () => 300
    const out = await prepareChatPhoto(phoneJpeg(5000))
    const [canvas] = fakes.canvases
    expect(canvas).toMatchObject({ width: 2048, height: 1536 })
    expect(canvas!.blobCalls).toEqual([['image/jpeg', CHAT_PHOTO_QUALITY]])
    expect(canvas!.ctx!.props).toMatchObject({ imageSmoothingQuality: 'high' })
    expect(out.type).toBe('image/jpeg')
    expect(out.size).toBe(300)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(URL_OF_PHOTO)
  })

  it('стоя (3000×4000) — по длинной стороне: 1536×2048', async () => {
    fakes.sizes.set(URL_OF_PHOTO, { width: 3000, height: 4000 })
    fakes.blobSize = () => 300
    await prepareChatPhoto(phoneJpeg(5000))
    expect(fakes.canvases[0]).toMatchObject({ width: 1536, height: 2048 })
  })

  it('лёгкий JPEG в пределах стороны — без пережатия, только без EXIF', async () => {
    fakes.sizes.set(URL_OF_PHOTO, { width: 1600, height: 1200 })
    const photo = phoneJpeg(5000)
    const out = await prepareChatPhoto(photo)
    expect(fakes.canvases).toHaveLength(0)
    const bytes = await bytesOf(out)
    expect(contains(bytes, ascii('GPS!'))).toBe(false)
    expect(bytes).toEqual(await bytesOf(await stripPhotoMetadata(photo)))
  })

  it('тяжёлый JPEG в пределах стороны — пережат в том же размере, если легче', async () => {
    fakes.sizes.set(URL_OF_PHOTO, { width: 1600, height: 1200 })
    fakes.blobSize = () => 200_000
    const out = await prepareChatPhoto(phoneJpeg(CHAT_PHOTO_REENCODE_MIN_BYTES + 1000))
    expect(fakes.canvases[0]).toMatchObject({ width: 1600, height: 1200 })
    expect(out.size).toBe(200_000)
  })

  it('пережатое не легче — уходит исходник без EXIF', async () => {
    fakes.sizes.set(URL_OF_PHOTO, { width: 4000, height: 3000 })
    const photo = phoneJpeg(5000)
    fakes.blobSize = () => 10_000
    const out = await prepareChatPhoto(photo)
    expect(fakes.canvases).toHaveLength(1)
    expect(await bytesOf(out)).toEqual(await bytesOf(await stripPhotoMetadata(photo)))
  })

  it('PNG больше стороны остаётся PNG (скриншот, прозрачность) — без потерь', async () => {
    fakes.sizes.set(URL_OF_PHOTO, { width: 1080, height: 2400 })
    fakes.blobSize = () => 500
    const out = await prepareChatPhoto(png())
    expect(fakes.canvases[0]).toMatchObject({ width: 922, height: 2048 })
    expect(fakes.canvases[0]!.blobCalls).toEqual([['image/png', undefined]])
    expect(out.type).toBe('image/png')
  })

  it('PNG в пределах стороны — как есть, без текстовых чанков', async () => {
    fakes.sizes.set(URL_OF_PHOTO, { width: 1920, height: 1080 })
    const out = await prepareChatPhoto(png(chunk('tEXt', ascii('GPS!'))))
    expect(fakes.canvases).toHaveLength(0)
    expect(out.type).toBe('image/png')
    expect(contains(await bytesOf(out), ascii('GPS!'))).toBe(false)
  })

  it('анимированный PNG и GIF — как есть: canvas оставил бы один кадр', async () => {
    fakes.sizes.set(URL_OF_PHOTO, { width: 4000, height: 3000 })
    const apng = await prepareChatPhoto(png(chunk('acTL', [0, 0, 0, 2, 0, 0, 0, 0])))
    expect(apng.type).toBe('image/png')
    const gif = new Blob([Uint8Array.from(ascii('GIF89a'))], { type: 'image/gif' })
    expect(await prepareChatPhoto(gif)).toBe(gif)
    expect(fakes.canvases).toHaveLength(0)
  })

  it('окно не декодирует — уходит без EXIF, но и без уменьшения', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const photo = phoneJpeg(5000)
    const out = await prepareChatPhoto(photo)
    expect(fakes.canvases).toHaveLength(0)
    expect(await bytesOf(out)).toEqual(await bytesOf(await stripPhotoMetadata(photo)))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(URL_OF_PHOTO)
  })

  it('битый JPEG перерисовывается сразу в 2048 и второй раз не пережимается', async () => {
    const broken = new Blob([Uint8Array.from([0xff, 0xd8, ...seg(0xe1, EXIF)])])
    const out = await prepareChatPhoto(broken)
    expect(resize.calls).toEqual([
      {
        source: 'data:image/jpeg;base64,/9j/AA==',
        options: { maxWidth: 2048, maxHeight: 2048, quality: CHAT_PHOTO_QUALITY },
      },
    ])
    expect(await bytesOf(out)).toEqual([0xff, 0xd8, 0xff, 0xd9])
    expect(fakes.canvases).toHaveLength(0)
  })
})
