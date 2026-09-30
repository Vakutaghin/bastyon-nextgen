/**
 * Окно продвижения поста: один синглтон-модал на всё приложение (монтируется в
 * src.vue) — как у чаевых, чтобы в ленте не было по окну на карточку.
 * Открывается кнопкой «Продвинуть» у поста через `open({...})`.
 */

import { defineStore } from 'pinia'

export interface BoostTarget {
  /** txid поста (для правленого — исходный, как у оценок). */
  postId: string
  /** Язык поста (`l`): бусты считаются по ленте этого языка. */
  language?: string
  /** Начало текста или заголовок — показать, какой пост продвигаем. */
  preview?: string
}

export const useBoostStore = defineStore('boost', {
  state: () => ({
    isOpen: false,
    target: null as BoostTarget | null,
  }),

  actions: {
    open(target: BoostTarget): void {
      if (!target?.postId) return
      this.target = target
      this.isOpen = true
    },

    close(): void {
      this.isOpen = false
    },
  },
})
