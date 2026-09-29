// Где есть свой узел Reticulum: только десктоп (Tauri), и не Windows —
// rns-net там не собирается.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRnsAvailable } from './rns-api'

const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
})

describe('isRnsAvailable', () => {
  it('needs the desktop app', () => {
    vi.stubGlobal('navigator', { userAgent: MAC })
    expect(isRnsAvailable()).toBe(false)
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    expect(isRnsAvailable()).toBe(true)
  })

  it('is off on Windows', () => {
    vi.stubGlobal('navigator', { userAgent: WINDOWS })
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    expect(isRnsAvailable()).toBe(false)
  })
})
