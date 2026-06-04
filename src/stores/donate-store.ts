/**
 * Глобальный стор доната: один синглтон-модал на всё приложение (монтируется в
 * src.vue), который открывается из любого места (карточка поста, меню коммента)
 * через `open({ address, name })`. Так избегаем N экземпляров модалки в ленте.
 */

import { defineStore } from 'pinia'

export const useDonateStore = defineStore('donate', {
  state: () => ({
    isOpen: false,
    /** Адрес получателя (автор поста/коммента). */
    address: '',
    /** Имя получателя для отображения (опционально). */
    name: '',
  }),

  actions: {
    /** Открывает модал доната для указанного автора. */
    open(target: { address: string; name?: string }): void {
      if (!target?.address) return
      this.address = target.address
      this.name = target.name || ''
      this.isOpen = true
    },

    close(): void {
      this.isOpen = false
    },
  },
})
