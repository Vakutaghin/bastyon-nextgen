// Качество — одно на все плееры: помнится на устройстве, «Авто» не хранится;
// уровень под выбранное качество — такой же или ближайший ниже.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VIDEO_QUALITY_KEY } from '@/blockchain/constants/storage'
import {
  levelForQuality,
  levelQuality,
  preferredQuality,
  qualityLabel,
  reloadPreferredQualityForTests,
  setPreferredQuality,
} from './video-quality'

describe('video-quality', () => {
  beforeEach(() => {
    localStorage.clear()
    reloadPreferredQualityForTests()
  })
  afterEach(() => {
    localStorage.clear()
    reloadPreferredQualityForTests()
  })

  it('выбор помнится до смены; «Авто» не хранится; мусор в хранилище — «Авто»', () => {
    expect(preferredQuality.value).toBeNull()
    setPreferredQuality(144)
    expect(localStorage.getItem(VIDEO_QUALITY_KEY)).toBe('144')
    reloadPreferredQualityForTests()
    expect(preferredQuality.value).toBe(144)

    setPreferredQuality(null)
    expect(localStorage.getItem(VIDEO_QUALITY_KEY)).toBeNull()

    localStorage.setItem(VIDEO_QUALITY_KEY, 'низкое')
    reloadPreferredQualityForTests()
    expect(preferredQuality.value).toBeNull()
  })

  it('вертикальный ролик — по короткой стороне, нестандартный — до ступени сверху', () => {
    expect(levelQuality({ width: 256, height: 144 })).toBe(144)
    expect(levelQuality({ width: 144, height: 256 })).toBe(144)
    expect(qualityLabel({ width: 360, height: 640 })).toBe('360p')
    expect(levelQuality({ height: 352 })).toBe(360)
    expect(levelQuality({ width: 3840, height: 2160 })).toBe(2160)
  })

  it('такой же уровень или ближайший ниже; все выше — самый низкий; уровней нет — -1', () => {
    const levels = [{ height: 1080 }, { height: 360 }, { height: 480 }]
    expect(levelForQuality(levels, 480)).toBe(2)
    expect(levelForQuality(levels, 720)).toBe(2)
    expect(levelForQuality(levels, 144)).toBe(1)
    expect(levelForQuality([], 144)).toBe(-1)
  })
})
