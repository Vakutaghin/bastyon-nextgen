import { beforeEach, describe, expect, it, vi } from 'vitest'

import { memStorage } from './vault/test-mem-storage'
import { accountScopedKey, adoptLegacyLocalKey, adoptLegacySettingsKey } from './account-scoped-key'

describe('account-scoped keys (Р5)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memStorage())
  })

  it('ключ с адресом и без', () => {
    expect(accountScopedKey('draft', 'PA')).toBe('draft:PA')
    expect(accountScopedKey('draft', null)).toBe('draft')
  })

  it('legacy-значение переезжает к первому аккаунту и только один раз', () => {
    localStorage.setItem('draft', 'old text')
    adoptLegacyLocalKey('draft', 'PA')
    expect(localStorage.getItem('draft:PA')).toBe('old text')
    expect(localStorage.getItem('draft')).toBeNull()
    // Второй аккаунт legacy уже не получает.
    adoptLegacyLocalKey('draft', 'PB')
    expect(localStorage.getItem('draft:PB')).toBeNull()
  })

  it('своё значение аккаунта не перетирается legacy', () => {
    localStorage.setItem('draft', 'old')
    localStorage.setItem('draft:PA', 'mine')
    adoptLegacyLocalKey('draft', 'PA')
    expect(localStorage.getItem('draft:PA')).toBe('mine')
    expect(localStorage.getItem('draft')).toBe('old')
  })

  it('settings: миграция через get/set', async () => {
    const store = new Map<string, unknown>([['hist', [1, 2]]])
    const api = {
      get: async (k: string) => store.get(k),
      set: async (k: string, v: unknown) => {
        store.set(k, v)
        return k
      },
    }
    expect(await adoptLegacySettingsKey(api, 'hist', 'PA')).toEqual([1, 2])
    expect(store.get('hist:PA')).toEqual([1, 2])
    expect(store.get('hist')).toBeUndefined()
    expect(await adoptLegacySettingsKey(api, 'hist', 'PB')).toBeUndefined()
    expect(await adoptLegacySettingsKey(api, 'hist', null)).toBeUndefined()
  })
})
