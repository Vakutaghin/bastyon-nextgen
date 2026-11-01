import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ tauri: false, androidTor: false, radio: false }))
vi.mock('@/helpers/api/request-tor', () => ({ isTauriEnv: () => mocks.tauri }))
vi.mock('@/helpers/tor/tor-bridge', () => ({ isAndroidTor: () => mocks.androidTor }))
vi.mock('@/mesh/radio/platform', () => ({ isRadioSupported: () => mocks.radio }))

import { PHONE_HEADER_ITEMS, unavailableReason } from './layout-items'

describe('unavailableReason', () => {
  beforeEach(() => {
    mocks.tauri = false
    mocks.androidTor = false
    mocks.radio = false
  })

  it('Tor is there in the desktop app and on Android, not in the browser', () => {
    expect(unavailableReason('tor')).toBe('settings.layout.desktopAndAndroid')
    mocks.androidTor = true
    expect(unavailableReason('tor')).toBeNull()
    mocks.androidTor = false
    mocks.tauri = true
    expect(unavailableReason('tor')).toBeNull()
  })

  it('IPFS stays desktop-only, also on Android', () => {
    mocks.androidTor = true
    expect(unavailableReason('ipfs')).toBe('settings.layout.desktopOnly')
    mocks.tauri = true
    expect(unavailableReason('ipfs')).toBeNull()
  })

  it('mesh radio follows the radio support check', () => {
    expect(unavailableReason('mesh')).toBe('settings.layout.desktopAndAndroid')
    mocks.radio = true
    expect(unavailableReason('mesh')).toBeNull()
  })
})

describe('PHONE_HEADER_ITEMS', () => {
  // На Android меню Tor открывается только значком в шапке.
  it('keeps the Tor icon in the phone header', () => {
    expect(PHONE_HEADER_ITEMS).toContain('tor')
  })
})
