// Где есть свой узел Reticulum: десктоп (Tauri) и приложение для Android;
// RNode по USB — везде, кроме Windows (там нет последовательного порта у rns-net).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRnodeSupported, isRnsAvailable } from './rns-api'

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

  it('runs on Windows too, but without RNode', () => {
    vi.stubGlobal('navigator', { userAgent: WINDOWS })
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    expect(isRnsAvailable()).toBe(true)
    expect(isRnodeSupported()).toBe(false)
    vi.stubGlobal('navigator', { userAgent: MAC })
    expect(isRnodeSupported()).toBe(true)
  })
})

describe('isRnsAvailable on Android', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).Capacitor
  })

  it('is on in the Android app, off in a plain browser', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)' })
    expect(isRnsAvailable()).toBe(false)
    ;(window as unknown as Record<string, unknown>).Capacitor = { getPlatform: () => 'android' }
    expect(isRnsAvailable()).toBe(true)
    ;(window as unknown as Record<string, unknown>).Capacitor = { getPlatform: () => 'ios' }
    expect(isRnsAvailable()).toBe(false)
  })
})
