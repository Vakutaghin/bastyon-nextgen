// Редактор коллекции или плейлиста — одно окно на приложение (src.vue).
// Новый: с готовыми элементами («Новый плейлист» из окна «Добавить в…»).
// Правка: по txid своей коллекции.

import { defineStore } from 'pinia'
import type { CollectionKind } from '@/services/collections/collection-model'

export interface CollectionEditorTarget {
  mode: 'create' | 'edit'
  kind: CollectionKind
  /** Правка: какая коллекция. */
  rootTxid?: string
  /** Новый: с чем создать. */
  initialIds?: string[]
}

export const useCollectionEditorStore = defineStore('collection-editor', {
  state: () => ({
    isOpen: false,
    target: null as CollectionEditorTarget | null,
    /** Номер открытия: то же окно заново — заново и черновик. */
    seq: 0,
  }),

  actions: {
    open(target: CollectionEditorTarget): void {
      this.target = target
      this.seq += 1
      this.isOpen = true
    },

    close(): void {
      this.isOpen = false
    },
  },
})
