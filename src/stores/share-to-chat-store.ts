/**
 * «Поделиться → Отправить в чат»: одно окно выбора чатов на всё приложение
 * (монтируется в src.vue, как чаевые и продвижение). Открывает его любое меню
 * «Поделиться» через `open({ link, title })`: пост, комментарий, профиль,
 * коллекция, мини-приложение, файл — всё уходит в чат ссылкой, которую
 * мессенджер сам показывает карточкой или открывает в приложении.
 */

import { defineStore } from 'pinia'

export interface ShareToChatTarget {
  /** Публичная ссылка — та же, что копирует «Поделиться». */
  link: string
  /** Что отправляем, одной строкой: заголовок поста, ник, название коллекции. */
  title?: string
  /**
   * В ссылке ключ (приватный файл IPFS): в чат без шифрования — открытую или
   * большую группу — её не отправить, ключ увидел бы сервер.
   */
  secret?: boolean
}

export const useShareToChatStore = defineStore('share-to-chat', {
  state: () => ({
    isOpen: false,
    target: null as ShareToChatTarget | null,
  }),

  actions: {
    open(target: ShareToChatTarget): void {
      if (!target?.link) return
      this.target = target
      this.isOpen = true
    },

    close(): void {
      this.isOpen = false
    },
  },
})
