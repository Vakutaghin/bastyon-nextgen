import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockStorage = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
})

import { setNeedShowMnemonic, shouldShowMnemonic, setDontShowMnemonic } from './mnemonic-storage'

describe('mnemonic-storage', () => {
  beforeEach(() => {
    mockStorage.clear()
  })

  describe('setNeedShowMnemonic', () => {
    it('sets flag in localStorage', () => {
      setNeedShowMnemonic('PAddr123')
      expect(localStorage.getItem('BST_NEED_SHOW_KEY_PAddr123')).toBe('true')
    })
  })

  describe('shouldShowMnemonic', () => {
    it('returns false for null address', () => {
      expect(shouldShowMnemonic(null)).toBe(false)
    })

    it('returns false when not set', () => {
      expect(shouldShowMnemonic('PAddr123')).toBe(false)
    })

    it('returns true when flag is set', () => {
      setNeedShowMnemonic('PAddr123')
      expect(shouldShowMnemonic('PAddr123')).toBe(true)
    })

    it('returns false after setDontShowMnemonic', () => {
      setNeedShowMnemonic('PAddr123')
      setDontShowMnemonic('PAddr123')
      expect(shouldShowMnemonic('PAddr123')).toBe(false)
    })
  })

  describe('setDontShowMnemonic', () => {
    it('sets flag to false in localStorage', () => {
      setNeedShowMnemonic('PAddr123')
      setDontShowMnemonic('PAddr123')
      expect(localStorage.getItem('BST_NEED_SHOW_KEY_PAddr123')).toBe('false')
    })
  })
})
