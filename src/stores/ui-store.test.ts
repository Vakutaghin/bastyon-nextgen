import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUIStore } from './ui-store'

describe('ui-store', () => {
  let store: ReturnType<typeof useUIStore>

  beforeEach(() => {
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

  describe('theme', () => {
    it('defaults to light', () => {
      expect(store.theme).toBe('light')
    })

    it('toggles theme', () => {
      store.toggleTheme()
      expect(store.theme).toBe('dark')
      store.toggleTheme()
      expect(store.theme).toBe('light')
    })

    it('sets theme directly', () => {
      store.setTheme('dark')
      expect(store.theme).toBe('dark')
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
