// Стоит ли сжимать: сжатие должно уменьшить файл хотя бы на пятую часть, а
// сжатый файл — поместиться в память приложения. Не знаем, что внутри, —
// решает FFmpeg.

import { describe, expect, it } from 'vitest'

import { MAX_COMPRESS_OUTPUT_BYTES, planCompression } from './compression-plan'

const MB = 1024 * 1024
const minutes = (n: number) => n * 60

describe('planCompression', () => {
  it('видео с телефона: 4K или 1080p с высоким битрейтом — сжимать', () => {
    // 10 минут 4K по 40 Мбит/с — около 3 ГБ, а в 1080p выйдет около 300 МБ.
    expect(planCompression({ width: 3840, height: 2160, duration: minutes(10) }, 3000 * MB)).toBe(
      'compress'
    )
    expect(planCompression({ width: 1920, height: 1080, duration: minutes(5) }, 1200 * MB)).toBe(
      'compress'
    )
    // Вертикальное видео — то же самое.
    expect(planCompression({ width: 1080, height: 1920, duration: minutes(5) }, 1200 * MB)).toBe(
      'compress'
    )
  })

  it('файл уже скромный — сжатие почти ничего не даст', () => {
    // 1080p по ~3,5 Мбит/с: сжатый вышел бы не меньше.
    expect(planCompression({ width: 1920, height: 1080, duration: minutes(5) }, 130 * MB)).toBe(
      'small'
    )
    // 720p по ~1,6 Мбит/с — как и вышло бы.
    expect(planCompression({ width: 1280, height: 720, duration: minutes(10) }, 120 * MB)).toBe(
      'small'
    )
    // Даже 4K, если битрейт уже низкий: битрейт сжатие не поднимает.
    expect(planCompression({ width: 3840, height: 2160, duration: minutes(10) }, 220 * MB)).toBe(
      'small'
    )
  })

  it('сжатый не поместится в память — слишком длинное', () => {
    // Час 1080p по 20 Мбит/с: в 1080p вышло бы около 1,8 ГБ.
    const hour = { width: 1920, height: 1080, duration: minutes(60) }
    expect(planCompression(hour, 9000 * MB)).toBe('long')
    expect(MAX_COMPRESS_OUTPUT_BYTES).toBe(1024 * MB)
  })

  it('не знаем, что внутри, — сжимать (решит FFmpeg)', () => {
    expect(planCompression(null, 500 * MB)).toBe('compress')
    expect(planCompression({ width: 0, height: 0, duration: 10 }, 500 * MB)).toBe('compress')
    expect(planCompression({ width: 1920, height: 1080, duration: NaN }, 500 * MB)).toBe('compress')
  })
})
