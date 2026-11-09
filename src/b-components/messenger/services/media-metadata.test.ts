// Метаданные вложений перед отправкой: размеры картинки, длительность и размеры
// видео, постер первого кадра (JPEG, не больше заданной стороны). Декодер
// браузера подменён; при любой ошибке — пустой результат, а object URL освобождён.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { extractImageDimensions, extractVideoMetadata } from './media-metadata'

// ─── Подмена декодера браузера ──────────────────────────────────────────────

const urls = { created: [] as string[], revoked: [] as string[] }
const realCreateObjectURL = URL.createObjectURL
const realRevokeObjectURL = URL.revokeObjectURL

class FakeImage {
  static last: FakeImage | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  width = 0
  height = 0
  src = ''
  constructor() {
    FakeImage.last = this
  }
}

class FakeVideo {
  preload = ''
  muted = false
  playsInline = false
  crossOrigin: string | null = null
  src = ''
  duration = NaN
  videoWidth = 0
  videoHeight = 0
  onerror: (() => void) | null = null
  onloadedmetadata: (() => void) | null = null
  seekedTo: number | null = null
  seekThrows = false
  load = vi.fn()
  private listeners = new Map<string, () => void>()
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, fn)
  }
  get currentTime() {
    return this.seekedTo ?? 0
  }
  set currentTime(v: number) {
    if (this.seekThrows) throw new Error('InvalidStateError')
    this.seekedTo = v
  }
  /** Браузер докрутил до кадра. */
  seeked() {
    this.listeners.get('seeked')?.()
  }
}

const POSTER = new Blob(['jpeg-bytes'], { type: 'image/jpeg' })

class FakeCanvas {
  width = 0
  height = 0
  ctx: { drawImage: ReturnType<typeof vi.fn> } | null = { drawImage: vi.fn() }
  blobResult: Blob | null = POSTER
  getContext = vi.fn(() => this.ctx)
  toBlob = vi.fn((cb: (b: Blob | null) => void, _type?: string, _quality?: number) =>
    cb(this.blobResult)
  )
}

let video: FakeVideo
let canvas: FakeCanvas

beforeEach(() => {
  urls.created.length = 0
  urls.revoked.length = 0
  let n = 0
  URL.createObjectURL = vi.fn(() => {
    const u = `blob:test/${++n}`
    urls.created.push(u)
    return u
  })
  URL.revokeObjectURL = vi.fn((u: string) => {
    urls.revoked.push(u)
  })
  vi.stubGlobal('Image', FakeImage)
  FakeImage.last = null

  video = new FakeVideo()
  canvas = new FakeCanvas()
  const realCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'video') return video
    if (tag === 'canvas') return canvas
    return realCreate(tag)
  }) as unknown as typeof document.createElement)
})

afterEach(() => {
  URL.createObjectURL = realCreateObjectURL
  URL.revokeObjectURL = realRevokeObjectURL
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const file = new Blob(['x'], { type: 'image/png' })

/** Все созданные object URL освобождены ровно по разу. */
function expectUrlsReleased() {
  expect(urls.created).toHaveLength(1)
  expect(urls.revoked).toEqual(urls.created)
}

// ─── Картинка ────────────────────────────────────────────────────────────────

describe('extractImageDimensions — размеры картинки', () => {
  it('декодировалась — натуральные размеры; object URL освобождён', async () => {
    const p = extractImageDimensions(file)
    const img = FakeImage.last!
    expect(img.src).toBe(urls.created[0])
    img.naturalWidth = 1920
    img.naturalHeight = 1080
    img.width = 300 // CSS-размер не важен
    img.onload!()
    await expect(p).resolves.toEqual({ w: 1920, h: 1080 })
    expectUrlsReleased()
  })

  it('нет натуральных размеров (SVG без viewBox) — берутся width/height', async () => {
    const p = extractImageDimensions(file)
    const img = FakeImage.last!
    img.width = 300
    img.height = 150
    img.onload!()
    await expect(p).resolves.toEqual({ w: 300, h: 150 })
  })

  it('нулевые размеры — null', async () => {
    const p = extractImageDimensions(file)
    FakeImage.last!.onload!()
    await expect(p).resolves.toBeNull()
    expectUrlsReleased()
  })

  it('файл не картинка (ошибка декодирования) — null, URL освобождён', async () => {
    const p = extractImageDimensions(new Blob(['not an image']))
    FakeImage.last!.onerror!()
    await expect(p).resolves.toBeNull()
    expectUrlsReleased()
  })
})

// ─── Видео ───────────────────────────────────────────────────────────────────

function loadMetadata(duration: number, w: number, h: number) {
  video.duration = duration
  video.videoWidth = w
  video.videoHeight = h
  video.onloadedmetadata!()
}

describe('extractVideoMetadata — длительность, размеры и постер', () => {
  it('Full HD: постер JPEG из кадра ~5% (не дальше 1.5 с), длинная сторона ужата до 768', async () => {
    const p = extractVideoMetadata(new Blob(['mp4'], { type: 'video/mp4' }))
    expect(video.src).toBe(urls.created[0])
    loadMetadata(40, 1920, 1080)
    expect(video.seekedTo).toBe(1.5)
    video.seeked()

    await expect(p).resolves.toEqual({ duration: 40, w: 1920, h: 1080, posterBlob: POSTER })
    expect([canvas.width, canvas.height]).toEqual([768, 432])
    expect(canvas.ctx!.drawImage).toHaveBeenCalledWith(video, 0, 0, 768, 432)
    expect(canvas.toBlob.mock.calls[0]!.slice(1)).toEqual(['image/jpeg', 0.7])
    expectUrlsReleased()
  })

  it('короткое маленькое видео: кадр с 0.1 с, постер в исходном размере (не растягивается)', async () => {
    const p = extractVideoMetadata(file)
    loadMetadata(1, 320, 240)
    expect(video.seekedTo).toBe(0.1)
    video.seeked()
    await expect(p).resolves.toMatchObject({ duration: 1, w: 320, h: 240, posterBlob: POSTER })
    expect([canvas.width, canvas.height]).toEqual([320, 240])
  })

  it('свой предел стороны постера; вертикальное видео ужимается по высоте', async () => {
    const p = extractVideoMetadata(file, 200)
    loadMetadata(10, 1080, 1920)
    video.seeked()
    await p
    expect([canvas.width, canvas.height]).toEqual([113, 200])
  })

  it('длительность неизвестна (Infinity у живой записи) — 0, постер всё равно есть', async () => {
    const p = extractVideoMetadata(file)
    loadMetadata(Infinity, 640, 360)
    expect(video.seekedTo).toBe(0.1)
    video.seeked()
    await expect(p).resolves.toMatchObject({ duration: 0, w: 640, h: 360, posterBlob: POSTER })
  })

  it('только звук (нет размеров кадра) — длительность без постера, без перемотки', async () => {
    const p = extractVideoMetadata(file)
    loadMetadata(12.5, 0, 0)
    await expect(p).resolves.toEqual({ duration: 12.5, w: 0, h: 0, posterBlob: null })
    expect(video.seekedTo).toBeNull()
    expectUrlsReleased()
  })

  it('файл не декодируется — нули и null, URL освобождён', async () => {
    const p = extractVideoMetadata(file)
    video.onerror!()
    await expect(p).resolves.toEqual({ duration: 0, w: 0, h: 0, posterBlob: null })
    expectUrlsReleased()
  })

  it('load() бросил — результат приходит по событиям как обычно', async () => {
    video.load.mockImplementation(() => {
      throw new Error('NotSupportedError')
    })
    const p = extractVideoMetadata(file)
    video.onerror!()
    await expect(p).resolves.toEqual({ duration: 0, w: 0, h: 0, posterBlob: null })
  })

  const posterFailures: Array<[string, () => void]> = [
    ['нет 2d-контекста', () => (canvas.ctx = null)],
    ['toBlob вернул null', () => (canvas.blobResult = null)],
    [
      'drawImage бросил (кадр недоступен)',
      () => {
        canvas.ctx!.drawImage.mockImplementation(() => {
          throw new Error('SecurityError')
        })
      },
    ],
  ]
  for (const [name, breakIt] of posterFailures) {
    it(`постер не получился (${name}) — размеры и длительность есть, постер null`, async () => {
      breakIt()
      const p = extractVideoMetadata(file)
      loadMetadata(8, 640, 480)
      video.seeked()
      await expect(p).resolves.toEqual({ duration: 8, w: 640, h: 480, posterBlob: null })
      expectUrlsReleased()
    })
  }

  it('перемотка невозможна — без постера, но с метаданными', async () => {
    video.seekThrows = true
    const p = extractVideoMetadata(file)
    loadMetadata(8, 640, 480)
    await expect(p).resolves.toEqual({ duration: 8, w: 640, h: 480, posterBlob: null })
    expectUrlsReleased()
  })

  it('ошибка после готового результата его не меняет, URL освобождается один раз', async () => {
    const p = extractVideoMetadata(file)
    loadMetadata(5, 640, 480)
    video.seeked()
    const result = await p
    video.onerror!()
    expect(result.posterBlob).toBe(POSTER)
    expectUrlsReleased()
  })
})
