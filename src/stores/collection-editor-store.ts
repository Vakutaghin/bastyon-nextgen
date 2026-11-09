// Окно «Создать» и правка публичной коллекции — одно окно на приложение
// (src.vue). Новый список: что внутри (видео, аудио, публикации) и кто видит
// (только я — личный, все — в блокчейне), можно сразу с записями («Новый
// список…» из окна «Добавить в…») или из личного списка, который становится
// публичным. Правка: по txid своей коллекции.

import { defineStore } from 'pinia'
import type { CollectionKind } from '@/services/collections/collection-model'

export type ListVisibility = 'private' | 'public'

export interface CollectionEditorTarget {
  mode: 'create' | 'edit'
  /** Что внутри; у нового — что выбрано сначала. */
  kind: CollectionKind
  /** Правка: какая коллекция. */
  rootTxid?: string
  /** Новый: с чем создать. */
  initialIds?: string[]
  /** Новый: кто видит сначала; без поля — только я. */
  visibility?: ListVisibility
  /** Новый: «Кто видит» не выбирается (личный становится публичным). */
  lockVisibility?: boolean
  /** Новый: что можно выбрать в «Что внутри»; без поля — всё. */
  kinds?: CollectionKind[]
  /** Новый: название заранее. */
  caption?: string
  /** Новый публичный — вместо этого личного списка (удалится, когда коллекция в блоке). */
  replaces?: string
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
