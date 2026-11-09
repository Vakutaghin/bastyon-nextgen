import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  computeResizedDimensions,
  isGifDataUrl,
  resizeImageBase64,
  fileToBase64,
  IMAGE_QUALITY,
} from './resize-image'
import { installCanvasFakes, type CanvasFakes } from './testing/canvas-fakes'

describe('computeResizedDimensions', () => {
  it('уменьшает по ширине, сохраняя пропорции', () => {
    // 4000×2000 в бокс 1920×1080: лимитирует ширина (0.48)
    expect(computeResizedDimensions(4000, 2000, 1920, 1080)).toEqual({ width: 1920, height: 960 })
  })

  it('уменьшает по высоте для вертикальных', () => {
    // 1080×1920 в 1920×1080: лимитирует высота (0.5625)
    expect(computeResizedDimensions(1080, 1920, 1920, 1080)).toEqual({ width: 608, height: 1080 })
  })

  it('не увеличивает изображение меньше бокса', () => {
    expect(computeResizedDimensions(1000, 500, 1920, 1080)).toEqual({ width: 1000, height: 500 })
  })

  it('квадрат вписывается по меньшей стороне бокса', () => {
    expect(computeResizedDimensions(2000, 2000, 1920, 1080)).toEqual({ width: 1080, height: 1080 })
  })

  it('нулевые размеры → {0,0}', () => {
    expect(computeResizedDimensions(0, 100)).toEqual({ width: 0, height: 0 })
    expect(computeResizedDimensions(100, 0)).toEqual({ width: 0, height: 0 })
  })

  it('использует дефолтный бокс 1920×1080', () => {
    expect(computeResizedDimensions(3840, 2160)).toEqual({ width: 1920, height: 1080 })
  })
})

describe('isGifDataUrl', () => {
  it('true для data:image/gif', () => {
    expect(isGifDataUrl('data:image/gif;base64,AAAA')).toBe(true)
  })

  it('false для других форматов', () => {
    expect(isGifDataUrl('data:image/png;base64,AAAA')).toBe(false)
    expect(isGifDataUrl('data:image/jpeg;base64,AAAA')).toBe(false)
    expect(isGifDataUrl('https://x/y.gif')).toBe(false)
  })
})

// Сжатие перед загрузкой: что уходит на сервер — размер, формат, качество.
describe('resizeImageBase64', () => {
  const BIG = 'data:image/jpeg;base64,BIG'
  const SMALL = 'data:image/png;base64,SMALL'
  let fakes: CanvasFakes

  beforeEach(() => {
    fakes = installCanvasFakes()
    fakes.sizes.set(BIG, { width: 4000, height: 3000 })
    fakes.sizes.set(SMALL, { width: 800, height: 600 })
  })

  afterEach(() => fakes.restore())

  it('большое фото вписывается в 1920×1080 и уходит JPEG с качеством по умолчанию', async () => {
    expect(await resizeImageBase64(BIG)).toBe(`data:image/jpeg;q=${IMAGE_QUALITY};1440x1080`)
    expect(fakes.canvases[0]!.ctx!.calls).toEqual([
      ['drawImage', expect.anything(), 0, 0, 1440, 1080],
    ])
  })

  it('свой бокс и качество', async () => {
    expect(await resizeImageBase64(BIG, { maxWidth: 400, maxHeight: 400, quality: 0.5 })).toBe(
      'data:image/jpeg;q=0.5;400x300'
    )
  })

  it('маленькая картинка не растягивается, но перекодируется в JPEG', async () => {
    expect(await resizeImageBase64(SMALL)).toBe(`data:image/jpeg;q=${IMAGE_QUALITY};800x600`)
  })

  it('GIF отдаётся как есть — анимация не теряется', async () => {
    const gif = 'data:image/gif;base64,R0lG'
    expect(await resizeImageBase64(gif)).toBe(gif)
    expect(fakes.canvases).toHaveLength(0)
  })

  it('картинка без размеров — исходник', async () => {
    const empty = 'data:image/png;base64,EMPTY'
    fakes.sizes.set(empty, { width: 0, height: 0 })
    expect(await resizeImageBase64(empty)).toBe(empty)
    expect(fakes.canvases).toHaveLength(0)
  })

  it('нет 2D-контекста — исходник', async () => {
    fakes.noContextOnce()
    expect(await resizeImageBase64(BIG)).toBe(BIG)
  })

  it('не декодировалась — понятная ошибка', async () => {
    await expect(resizeImageBase64('data:image/jpeg;base64,broken')).rejects.toThrow(
      'Failed to load image for resize'
    )
  })

  it('холст не отдаёт данные (tainted) — ошибка, а не пустая строка', async () => {
    fakes.throwOnceOnExport()
    await expect(resizeImageBase64(BIG)).rejects.toThrow('tainted')
  })
})

describe('fileToBase64', () => {
  it('файл читается в data-URL со своим типом', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    expect(await fileToBase64(file)).toBe('data:image/png;base64,AQID')
  })
})
