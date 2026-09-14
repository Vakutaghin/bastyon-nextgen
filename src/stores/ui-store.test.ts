import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: { get: vi.fn(async () => undefined), set: vi.fn(async (k: string) => k) },
}))

import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import { useUIStore } from './ui-store'

describe('ui-store', () => {
  let store: ReturnType<typeof useUIStore>

  beforeEach(() => {
    vi.stubGlobal('localStorage', memStorage())
    setActivePinia(createPinia())
    store = useUIStore()
  })

  describe('scroll positions', () => {
    it('saves and retrieves scroll position', () => {
      store.saveScrollPosition('feed', 150)
      expect(store.getScrollPosition('feed')).toBe(150)
    })

    it('returns 0 for unknown key', () => {
      expect(store.getScrollPosition('unknown')).toBe(0)
    })

    it('clears all scroll positions', () => {
      store.saveScrollPosition('feed', 100)
      store.saveScrollPosition('profile', 200)
      store.clearScrollPositions()
      expect(store.getScrollPosition('feed')).toBe(0)
      expect(store.getScrollPosition('profile')).toBe(0)
    })
  })

  describe('loading states', () => {
    it('sets loading state', () => {
      store.setLoading('feed', true)
      expect(store.isLoading('feed')).toBe(true)
    })

    it('clears loading state', () => {
      store.setLoading('feed', true)
      store.setLoading('feed', false)
      expect(store.isLoading('feed')).toBe(false)
    })

    it('returns false for unknown key', () => {
      expect(store.isLoading('unknown')).toBe(false)
    })

    it('clears all loading states', () => {
      store.setLoading('feed', true)
      store.setLoading('profile', true)
      store.clearLoadingStates()
      expect(store.isLoading('feed')).toBe(false)
      expect(store.isLoading('profile')).toBe(false)
    })
  })

  describe('language (V42)', () => {
    it('явный выбор в localStorage главнее старого IDB-значения', async () => {
      localStorage.setItem('bastyon_locale', 'en')
      const { settingsAPI } = await import('@/db/apis/settings-api')
      vi.mocked(settingsAPI.get).mockClear().mockResolvedValue('ru')
      setActivePinia(createPinia())
      const fresh = useUIStore()
      expect(fresh.language).toBe('en')
      await fresh.loadLanguage()
      expect(fresh.language).toBe('en')
      expect(fresh.languageLoaded).toBe(true)
      expect(settingsAPI.get).not.toHaveBeenCalled()
    })

    it('без localStorage старое IDB-значение переносится и применяется', async () => {
      const { settingsAPI } = await import('@/db/apis/settings-api')
      vi.mocked(settingsAPI.get).mockResolvedValue('en')
      const { i18n } = await import('@/i18n')
      i18n.global.locale.value = 'ru'
      setActivePinia(createPinia())
      const fresh = useUIStore()
      fresh.language = 'ru'
      await fresh.loadLanguage()
      expect(fresh.language).toBe('en')
      expect(i18n.global.locale.value).toBe('en')
      expect(localStorage.getItem('bastyon_locale')).toBe('en')
    })

    it('setLanguage меняет i18n, localStorage и IDB вместе', async () => {
      const { settingsAPI } = await import('@/db/apis/settings-api')
      const { i18n } = await import('@/i18n')
      await store.setLanguage('en')
      expect(store.language).toBe('en')
      expect(i18n.global.locale.value).toBe('en')
      expect(localStorage.getItem('bastyon_locale')).toBe('en')
      expect(settingsAPI.set).toHaveBeenCalledWith('bastyonAppLanguage', 'en')
    })
  })

  describe('sidebar', () => {
    it('defaults to not collapsed', () => {
      expect(store.sidebarCollapsed).toBe(false)
    })

    it('toggles sidebar', () => {
      store.toggleSidebar()
      expect(store.sidebarCollapsed).toBe(true)
      store.toggleSidebar()
      expect(store.sidebarCollapsed).toBe(false)
    })

    it('sets sidebar collapsed directly', () => {
      store.setSidebarCollapsed(true)
      expect(store.sidebarCollapsed).toBe(true)
    })
  })
})
