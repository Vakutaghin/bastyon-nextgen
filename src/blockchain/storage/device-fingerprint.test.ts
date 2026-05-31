import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateDeviceFingerprint, getDeviceFingerprint } from './device-fingerprint'
import { DEVICE_FINGERPRINT_KEY } from '../constants/storage'

// CryptoJS и navigator/screen/document берём реальные (happy-dom) — fingerprint
// детерминирован в рамках прогона. localStorage — рабочая in-memory заглушка.
function memStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('generateDeviceFingerprint', () => {
  it('возвращает 64-символьный hex (SHA-256)', () => {
    expect(generateDeviceFingerprint()).toMatch(/^[0-9a-f]{64}$/)
  })

  it('детерминирован в одном окружении', () => {
    expect(generateDeviceFingerprint()).toBe(generateDeviceFingerprint())
  })
})

describe('getDeviceFingerprint', () => {
  it('генерирует и сохраняет fingerprint при первом вызове', () => {
    const fp = getDeviceFingerprint()
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
    expect(localStorage.getItem(DEVICE_FINGERPRINT_KEY)).toBe(fp)
  })

  it('возвращает сохранённое значение при повторном вызове', () => {
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'CUSTOM_SAVED_VALUE')
    expect(getDeviceFingerprint()).toBe('CUSTOM_SAVED_VALUE')
  })

  it('forceRegenerate=true игнорирует сохранённое значение', () => {
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'CUSTOM_SAVED_VALUE')
    const fp = getDeviceFingerprint(true)
    expect(fp).not.toBe('CUSTOM_SAVED_VALUE')
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
    // перегенерированное значение перезаписывает сохранённое
    expect(localStorage.getItem(DEVICE_FINGERPRINT_KEY)).toBe(fp)
  })

  it('перегенерирует слишком короткое сохранённое значение (<8 символов)', () => {
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'short')
    const fp = getDeviceFingerprint()
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
    expect(fp).not.toBe('short')
  })

  it('стабилен между вызовами (кеш)', () => {
    const first = getDeviceFingerprint()
    const second = getDeviceFingerprint()
    expect(second).toBe(first)
  })
})
