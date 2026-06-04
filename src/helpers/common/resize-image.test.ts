import { describe, it, expect } from 'vitest'

import { computeResizedDimensions, isGifDataUrl } from './resize-image'

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
