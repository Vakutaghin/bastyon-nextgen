// Окно «Добавить в…» — одно на приложение (монтируется в src.vue), как у
// продвижения поста. Открывается из меню ролика, трека или поста.

import { defineStore } from 'pinia'

export interface AddToListTarget {
  /** txid поста (первой версии). */
  postId: string
  /** Тип поста: 'video', 'audio', 'share', 'article'… */
  type: string
  /** Заголовок — показать, что добавляем. */
  title: string
}

export const useAddToListStore = defineStore('add-to-list', {
  state: () => ({
    isOpen: false,
    target: null as AddToListTarget | null,
  }),

  actions: {
    open(target: AddToListTarget): void {
      if (!target?.postId) return
      this.target = target
      this.isOpen = true
    },

    close(): void {
      this.isOpen = false
    },
  },
})
