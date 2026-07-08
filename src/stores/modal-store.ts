import { defineStore } from 'pinia'
import { POST_MODAL_SCROLL_POSITION_KEY } from '@/blockchain/constants/storage'
import type { GetTopFeedPost as Post } from '@/types/rpc-responses/get-top-feed'
import type {
  ComposerMode,
  ComposerSource,
} from '@/b-components/content/post-composer/composer-source'

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
      scrollPosition: 0,
    },
    imageGallery: {
      isOpen: false,
      images: [] as string[],
      index: 0,
      scrollPosition: 0,
    } as ImageGalleryState,
    // Модальное окно авторизации (управляется через store для вызова из любой части приложения)
    authModal: {
      isOpen: false,
      mode: 'login' as 'login' | 'register',
    },
    // Модальное окно композера поста (создание / редактирование / репост)
    postComposerModal: {
      isOpen: false,
      mode: 'create' as ComposerMode,
      source: null as ComposerSource | null,
    },
    // P0-1: недискардимая модалка разблокировки сейфа (passphrase-режим).
    // Только UI-состояние; резолвер unlock живёт в vault-unlock.ts (module-scope).
    vaultUnlock: {
      isOpen: false,
    },
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
     * Открывает модалку композера поста.
     * @param options.mode  create (по умолчанию) / edit / repost
     * @param options.source источник для edit/repost (пост из ленты)
     */
    openPostComposerModal(
      options: { mode?: ComposerMode; source?: ComposerSource | null } = {}
    ): void {
      this.postComposerModal.mode = options.mode ?? 'create'
      this.postComposerModal.source = options.source ?? null
      this.postComposerModal.isOpen = true
    },

    /**
     * Закрывает модалку композера поста
     */
    closePostComposerModal(): void {
      this.postComposerModal.isOpen = false
    },

    /** Открывает модалку разблокировки сейфа (вызывается мостом vault-unlock). */
    openVaultUnlock(): void {
      this.vaultUnlock.isOpen = true
    },

    /** Закрывает модалку разблокировки сейфа. */
    closeVaultUnlock(): void {
      this.vaultUnlock.isOpen = false
    },

    /**
     * Открывает модалку с постом
     */
    openPostModal(post: Post): void {
      // Сохраняем позицию скролла
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
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
          behavior: 'instant',
        })
      })
    },

    /**
     * Открывает галерею изображений
     */
    openImageGallery(images: string[], index: number = 0): void {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
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
          behavior: 'instant',
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
    },
  },
})
