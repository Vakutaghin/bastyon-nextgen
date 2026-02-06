import { defineStore } from 'pinia'
import { POST_MODAL_SCROLL_POSITION_KEY } from '@/blockchain/constants/storage'
import type { Post } from '@/types/post'

interface ImageGalleryState {
  isOpen: boolean
  images: string[]
  index: number
  scrollPosition: number
}

export const useModalStore = defineStore('modal', {
  state: () => ({
    postModal: {
      isOpen: false,
      post: null as Post | null,
      scrollPosition: 0
    },
    imageGallery: {
      isOpen: false,
      images: [] as string[],
      index: 0,
      scrollPosition: 0
    } as ImageGalleryState,
    // Модальное окно авторизации (управляется через store для вызова из любой части приложения)
    authModal: {
      isOpen: false,
      mode: 'login' as 'login' | 'register'
    }
  }),

  actions: {
    /**
     * Открывает модалку авторизации
     */
    openAuthModal(mode: 'login' | 'register' = 'login'): void {
      this.authModal.mode = mode
      this.authModal.isOpen = true
    },

    /**
     * Закрывает модалку авторизации
     */
    closeAuthModal(): void {
      this.authModal.isOpen = false
    },

    /**
     * Открывает модалку с постом
     */
    openPostModal(post: Post): void {
      // Сохраняем позицию скролла
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
      this.postModal.scrollPosition = scrollTop

      // Сохраняем в sessionStorage как резерв
      try {
        sessionStorage.setItem(POST_MODAL_SCROLL_POSITION_KEY, String(scrollTop))
      } catch (e) {
        // Игнорируем ошибки sessionStorage
      }

      this.postModal.post = post
      this.postModal.isOpen = true
    },

    /**
     * Закрывает модалку с постом
     */
    closePostModal(): void {
      this.postModal.isOpen = false
      this.postModal.post = null

      // Восстанавливаем позицию скролла
      requestAnimationFrame(() => {
        window.scrollTo({
          top: this.postModal.scrollPosition,
          left: 0,
          behavior: 'instant'
        })
      })
    },

    /**
     * Открывает галерею изображений
     */
    openImageGallery(images: string[], index: number = 0): void {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
      this.imageGallery.scrollPosition = scrollTop
      this.imageGallery.images = images
      this.imageGallery.index = index
      this.imageGallery.isOpen = true
    },

    /**
     * Закрывает галерею изображений
     */
    closeImageGallery(): void {
      this.imageGallery.isOpen = false
      const scrollPosition = this.imageGallery.scrollPosition

      // Убираем блокировки скролла
      const ensureScrollUnlocked = (): void => {
        if (document.body.style.overflow === 'hidden') {
          document.body.style.overflow = ''
        }
        if (document.body.style.position === 'fixed') {
          document.body.style.position = ''
          document.body.style.top = ''
        }
        if (document.documentElement.style.overflow === 'hidden') {
          document.documentElement.style.overflow = ''
        }

        window.scrollTo({
          top: scrollPosition,
          left: 0,
          behavior: 'instant'
        })
      }

      ensureScrollUnlocked()
      requestAnimationFrame(() => {
        ensureScrollUnlocked()
        requestAnimationFrame(() => {
          ensureScrollUnlocked()
        })
      })
    },

    /**
     * Обновляет индекс в галерее
     */
    setImageGalleryIndex(index: number): void {
      this.imageGallery.index = index
    }
  }
})
