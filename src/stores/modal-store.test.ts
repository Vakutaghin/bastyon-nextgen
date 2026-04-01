import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useModalStore } from './modal-store'

describe('modal-store', () => {
  let store: ReturnType<typeof useModalStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useModalStore()
  })

  describe('auth modal', () => {
    it('defaults to closed', () => {
      expect(store.authModal.isOpen).toBe(false)
    })

    it('opens with default login mode', () => {
      store.openAuthModal()
      expect(store.authModal.isOpen).toBe(true)
      expect(store.authModal.mode).toBe('login')
    })

    it('opens with register mode', () => {
      store.openAuthModal('register')
      expect(store.authModal.isOpen).toBe(true)
      expect(store.authModal.mode).toBe('register')
    })

    it('closes', () => {
      store.openAuthModal()
      store.closeAuthModal()
      expect(store.authModal.isOpen).toBe(false)
    })
  })

  describe('post modal', () => {
    it('defaults to closed', () => {
      expect(store.postModal.isOpen).toBe(false)
      expect(store.postModal.post).toBeNull()
    })

    it('opens with post', () => {
      const post = { id: '1', title: 'Test' } as any
      store.openPostModal(post)
      expect(store.postModal.isOpen).toBe(true)
      expect(store.postModal.post).toStrictEqual(post)
    })

    it('closes and clears post', () => {
      store.openPostModal({ id: '1' } as any)
      store.closePostModal()
      expect(store.postModal.isOpen).toBe(false)
      expect(store.postModal.post).toBeNull()
    })
  })

  describe('image gallery', () => {
    it('defaults to closed', () => {
      expect(store.imageGallery.isOpen).toBe(false)
      expect(store.imageGallery.images).toEqual([])
    })

    it('opens with images', () => {
      store.openImageGallery(['img1.jpg', 'img2.jpg'], 1)
      expect(store.imageGallery.isOpen).toBe(true)
      expect(store.imageGallery.images).toEqual(['img1.jpg', 'img2.jpg'])
      expect(store.imageGallery.index).toBe(1)
    })

    it('defaults to index 0', () => {
      store.openImageGallery(['img1.jpg'])
      expect(store.imageGallery.index).toBe(0)
    })

    it('closes gallery', () => {
      store.openImageGallery(['img1.jpg'])
      store.closeImageGallery()
      expect(store.imageGallery.isOpen).toBe(false)
    })

    it('updates gallery index', () => {
      store.openImageGallery(['a', 'b', 'c'])
      store.setImageGalleryIndex(2)
      expect(store.imageGallery.index).toBe(2)
    })
  })
})
