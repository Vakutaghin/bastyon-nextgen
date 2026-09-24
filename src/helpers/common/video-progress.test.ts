import { describe, it, expect } from 'vitest'
import {
  isTrackableDuration,
  resumePosition,
  shouldSavePosition,
  videoProgressKey,
} from './video-progress'

describe('videoProgressKey', () => {
  it('одинаков для одной ссылки с разными одноразовыми параметрами', () => {
    const a = videoProgressKey('https://peertube.io/static/streaming/abc/master.m3u8?token=111')
    const b = videoProgressKey('https://peertube.io/static/streaming/abc/master.m3u8?token=222&t=5')
    expect(a).toBe(b)
    expect(a).toBe('peertube.io/static/streaming/abc/master.m3u8')
  })

  it('различает разные ролики', () => {
    expect(videoProgressKey('https://h.io/a.m3u8')).not.toBe(
      videoProgressKey('https://h.io/b.m3u8')
    )
  })

  it('не отслеживает blob и data', () => {
    expect(videoProgressKey('blob:https://h.io/abc')).toBeNull()
    expect(videoProgressKey('data:video/mp4;base64,AAA')).toBeNull()
  })

  it('пустую ссылку не отслеживает', () => {
    expect(videoProgressKey('')).toBeNull()
    expect(videoProgressKey('   ')).toBeNull()
  })
})

describe('isTrackableDuration', () => {
  it('короткие ролики не считает', () => {
    expect(isTrackableDuration(30)).toBe(false)
    expect(isTrackableDuration(89)).toBe(false)
    expect(isTrackableDuration(90)).toBe(true)
  })

  it('переживает NaN и Infinity (живой поток)', () => {
    expect(isTrackableDuration(NaN)).toBe(false)
    expect(isTrackableDuration(Infinity)).toBe(false)
  })
})

describe('shouldSavePosition', () => {
  it('не пишет самое начало', () => {
    expect(shouldSavePosition(5, 600)).toBe(false)
    expect(shouldSavePosition(15, 600)).toBe(true)
  })

  it('не пишет хвост: это «досмотрел», а не «прервался»', () => {
    expect(shouldSavePosition(585, 600)).toBe(false)
    expect(shouldSavePosition(580, 600)).toBe(true)
  })

  it('не пишет для короткого ролика', () => {
    expect(shouldSavePosition(30, 60)).toBe(false)
  })
})

describe('resumePosition', () => {
  it('возвращает сохранённую позицию', () => {
    expect(resumePosition(300, 600)).toBe(300)
  })

  it('не продолжает с начала и с хвоста', () => {
    expect(resumePosition(10, 600)).toBeNull()
    expect(resumePosition(595, 600)).toBeNull()
  })

  it('не продолжает, если ролик оказался короче сохранённой позиции', () => {
    expect(resumePosition(300, 120)).toBeNull()
  })

  it('не продолжает короткий ролик', () => {
    expect(resumePosition(40, 60)).toBeNull()
  })
})
