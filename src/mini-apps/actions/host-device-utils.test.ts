import { describe, it, expect, vi, afterEach } from 'vitest'
import { detectDevice, browserGeolocation } from './host-device-utils'

afterEach(() => vi.unstubAllGlobals())

describe('detectDevice', () => {
  it('tauri имеет приоритет', () => {
    expect(detectDevice(true, false)).toBe('tauri')
    expect(detectDevice(true, true)).toBe('tauri')
  })

  it('capacitor + iOS UA → capacitor_ios', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)' })
    expect(detectDevice(false, true)).toBe('capacitor_ios')
  })

  it('capacitor + Android UA → capacitor_android', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 13)' })
    expect(detectDevice(false, true)).toBe('capacitor_android')
  })

  it('capacitor + прочий UA → capacitor_android (по умолчанию)', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })
    expect(detectDevice(false, true)).toBe('capacitor_android')
  })

  it('ни tauri, ни capacitor → browser', () => {
    expect(detectDevice(false, false)).toBe('browser')
  })
})

describe('browserGeolocation', () => {
  it('reject location:notavailable, если geolocation недоступен', async () => {
    vi.stubGlobal('navigator', {})
    await expect(browserGeolocation()).rejects.toThrow('location:notavailable')
  })

  it('reject location:aborted, если сигнал уже прерван', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn() } })
    const controller = new AbortController()
    controller.abort()
    await expect(browserGeolocation(controller.signal)).rejects.toThrow('location:aborted')
  })

  it('resolve координатами при успехе', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void) =>
          ok({ coords: { latitude: 55.75, longitude: 37.61 } }),
      },
    })
    await expect(browserGeolocation()).resolves.toEqual({ latitude: 55.75, longitude: 37.61 })
  })

  it('reject location:notavailable при ошибке геолокации', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_ok: unknown, err: (e: unknown) => void) => err(new Error('denied')),
      },
    })
    await expect(browserGeolocation()).rejects.toThrow('location:notavailable')
  })
})
