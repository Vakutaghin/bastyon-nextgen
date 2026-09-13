import { describe, it, expect, beforeEach, vi } from 'vitest'

import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import {
  RESUME_TTL_MS,
  clearResumableState,
  loadResumableState,
  resumableStorageKey,
  saveResumableState,
} from './peertube-upload-resume'

const KEY = resumableStorageKey('h', 'ADDR', 'VK')
const state = { uploadHost: 'h', uploadId: 'U1', resumeFrom: 512, lastOperation: 10_000 }

beforeEach(() => vi.stubGlobal('localStorage', memStorage()))

describe('peertube-upload-resume', () => {
  it('ключ совпадает с legacy-форматом', () => {
    expect(KEY).toBe('resumable_h_ADDR_VK')
  })

  it('save → load возвращает то же состояние, clear удаляет', () => {
    saveResumableState(KEY, state)
    expect(loadResumableState(KEY, 10_000)).toEqual(state)
    clearResumableState(KEY)
    expect(loadResumableState(KEY, 10_000)).toBeNull()
  })

  it('протухшее (старше TTL) и битое состояние → null', () => {
    saveResumableState(KEY, state)
    expect(loadResumableState(KEY, 10_000 + RESUME_TTL_MS + 1)).toBeNull()
    localStorage.setItem(KEY, JSON.stringify({ uploadId: 'U1' }))
    expect(loadResumableState(KEY, 10_000)).toBeNull()
    localStorage.setItem(KEY, '{not json')
    expect(loadResumableState(KEY, 10_000)).toBeNull()
  })

  it('недоступный storage не роняет вызовы', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => saveResumableState(KEY, state)).not.toThrow()
    expect(loadResumableState(KEY, 1)).toBeNull()
    expect(() => clearResumableState(KEY)).not.toThrow()
  })
})
