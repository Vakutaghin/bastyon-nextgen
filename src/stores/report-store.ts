/**
 * Глобальный стор жалоб: один синглтон-модал на всё приложение (монтируется в
 * src.vue), открывается из любого места (карточка поста, меню коммента) через
 * `open({ contentHash, authorAddress, type })`. Как и [[donate-store]], так
 * избегаем N экземпляров модалки в ленте.
 *
 * Жалоба уходит on-chain как `modFlag`-транзакция (см. complain-action.ts) —
 * это нативный механизм модерации протокола, без посредников/централизованных
 * эндпоинтов (принцип `principle_decentralization`).
 */

import { defineStore } from 'pinia'

export type ReportTargetType = 'post' | 'comment'

export interface ReportTarget {
  /** s2 — txid поста/коммента, на который жалуемся. */
  contentHash: string
  /** s3 — адрес автора контента. */
  authorAddress: string
  /** Тип контента — влияет только на заголовок/тексты модалки. */
  type: ReportTargetType
}

export const useReportStore = defineStore('report', {
  state: () => ({
    isOpen: false,
    contentHash: '',
    authorAddress: '',
    type: 'post' as ReportTargetType,
  }),

  actions: {
    /** Открывает модал жалобы для указанного контента. */
    open(target: ReportTarget): void {
      if (!target?.contentHash || !target?.authorAddress) return
      this.contentHash = target.contentHash
      this.authorAddress = target.authorAddress
      this.type = target.type
      this.isOpen = true
    },

    close(): void {
      this.isOpen = false
    },
  },
})
