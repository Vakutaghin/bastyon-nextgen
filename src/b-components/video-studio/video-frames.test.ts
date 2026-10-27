// Кадры для обложки снимаются в окне из выбранного файла. Здесь — расчёты;
// сам снимок кадра проверяет e2e в настоящем браузере.

import { describe, expect, it } from 'vitest'

import { canCaptureFrames, firstFrame, fitSize, openFrameSource, stripTimes } from './video-frames'

describe('fitSize', () => {
  it('уменьшает по длинной стороне и сохраняет пропорции', () => {
    expect(fitSize(1920, 1080, 1280)).toEqual({ width: 1280, height: 720 })
    expect(fitSize(1080, 1920, 1280)).toEqual({ width: 720, height: 1280 })
  })

  it('маленькое не увеличивает', () => {
    expect(fitSize(426, 240, 1280)).toEqual({ width: 426, height: 240 })
  })
})

describe('stripTimes', () => {
  it('первый кадр и дальше поровну', () => {
    expect(stripTimes(30, 3)).toEqual([0, 10, 20])
  })

  it('длительность неизвестна — только первый кадр', () => {
    expect(stripTimes(0, 8)).toEqual([0])
    expect(stripTimes(Number.NaN, 8)).toEqual([0])
  })
})

describe('без canvas', () => {
  it('кадр не снимается, и это не ошибка: обложку выберет сервер', async () => {
    expect(canCaptureFrames()).toBe(false)
    const file = new File([new Uint8Array(10)], 'a.mp4', { type: 'video/mp4' })
    await expect(openFrameSource(file)).resolves.toBeNull()
    await expect(firstFrame(file)).resolves.toBeNull()
  })
})
