import { describe, it, expect } from 'vitest'
import { parsePeerTubeUrl, composePeerTubeUrl } from './peertube-parser'

describe('composePeerTubeUrl', () => {
  it('видео без суффикса', () => {
    expect(composePeerTubeUrl('h.app', 'abc')).toBe('peertube://h.app/abc')
  })
  it('аудио → суффикс /audio', () => {
    expect(composePeerTubeUrl('h.app', 'abc', { isAudio: true })).toBe('peertube://h.app/abc/audio')
  })
  it('лайв → суффикс /stream', () => {
    expect(composePeerTubeUrl('h.app', 'abc', { isLive: true })).toBe('peertube://h.app/abc/stream')
  })
  it('audio приоритетнее live', () => {
    expect(composePeerTubeUrl('h', 'x', { isAudio: true, isLive: true })).toBe(
      'peertube://h/x/audio'
    )
  })
  it('пустой host/videoId → бросает', () => {
    expect(() => composePeerTubeUrl('', 'x')).toThrow('peertube_pointer_invalid')
    expect(() => composePeerTubeUrl('h', '')).toThrow('peertube_pointer_invalid')
  })
})

describe('compose ↔ parse round-trip', () => {
  it('видео', () => {
    const url = composePeerTubeUrl('peertube359.pocketnet.app', 'uuid-1')
    expect(parsePeerTubeUrl(url)).toEqual({
      host: 'peertube359.pocketnet.app',
      videoId: 'uuid-1',
      type: undefined,
    })
  })
  it('аудио сохраняет тип', () => {
    const url = composePeerTubeUrl('h', 'uuid-2', { isAudio: true })
    expect(parsePeerTubeUrl(url)).toEqual({ host: 'h', videoId: 'uuid-2', type: 'audio' })
  })
})
