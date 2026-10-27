import { afterEach, describe, expect, it, vi } from 'vitest'
import { canDecodeH264, isLinuxDesktopApp } from './codec-support'

const LINUX_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)'
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'

function stubCodecs(mse: boolean | null, canPlay: string): void {
  if (mse === null) vi.stubGlobal('MediaSource', undefined)
  else vi.stubGlobal('MediaSource', { isTypeSupported: () => mse })
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue(canPlay as CanPlayTypeResult)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
})

describe('canDecodeH264', () => {
  it('MediaSource принимает H.264 — да', () => {
    stubCodecs(true, '')
    expect(canDecodeH264()).toBe(true)
  })

  it('без MediaSource решает canPlayType', () => {
    stubCodecs(null, 'maybe')
    expect(canDecodeH264()).toBe(true)
  })

  it('ни MediaSource, ни <video> не знают H.264 — нет (Linux без gstreamer1.0-libav)', () => {
    stubCodecs(false, '')
    expect(canDecodeH264()).toBe(false)
  })

  it('проверка сама упала — пусть плеер пробует', () => {
    vi.stubGlobal('MediaSource', {
      isTypeSupported: () => {
        throw new Error('boom')
      },
    })
    expect(canDecodeH264()).toBe(true)
  })
})

describe('isLinuxDesktopApp', () => {
  it('приложение Tauri на Linux', () => {
    ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(LINUX_UA)
    expect(isLinuxDesktopApp()).toBe(true)
  })

  it('Tauri на macOS — нет', () => {
    ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(MAC_UA)
    expect(isLinuxDesktopApp()).toBe(false)
  })

  it('браузер на Linux — нет: кодеки там у браузера, не у системы', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(LINUX_UA)
    expect(isLinuxDesktopApp()).toBe(false)
  })
})
