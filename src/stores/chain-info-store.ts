/**
 * «В блокчейне»: одна модалка на всё приложение (монтируется в src.vue) с
 * тем, что записано в блокчейне о посте, комментарии, аккаунте или
 * транзакции. Открывается поверх ленты, чата или кошелька: закрыл — и
 * дальше листаешь с того же места, без перехода в обозреватель.
 *
 * Внутри модалки можно идти дальше — от поста к транзакции правки, от неё к
 * адресу. Пройденное лежит стопкой: «Назад» возвращает на шаг.
 */

import { defineStore } from 'pinia'

export type ChainInfoTarget =
  /** Пост — по txid первой публикации (правки идут под тем же id). */
  | { kind: 'post'; txid: string }
  /** Комментарий — по id (txid первой версии) и посту, к которому он написан. */
  | { kind: 'comment'; id: string; postId: string }
  | { kind: 'account'; address: string }
  | { kind: 'tx'; txid: string }

/** Глубже не нужно: дальше — обозреватель. */
export const CHAIN_INFO_MAX_DEPTH = 20

/**
 * Что сделать, когда из модалки уходят на страницу приложения (обозреватель,
 * профиль). Модалка над полноэкранным чатом закрывает и чат: иначе страница
 * откроется под ним.
 */
let onLeave: (() => void) | null = null

function sameTarget(a: ChainInfoTarget, b: ChainInfoTarget): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function isValid(target: ChainInfoTarget | null | undefined): target is ChainInfoTarget {
  if (!target) return false
  switch (target.kind) {
    case 'post':
    case 'tx':
      return !!target.txid
    case 'comment':
      return !!target.id && !!target.postId
    case 'account':
      return !!target.address
  }
}

export const useChainInfoStore = defineStore('chainInfo', {
  state: () => ({
    stack: [] as ChainInfoTarget[],
  }),

  getters: {
    isOpen: (state): boolean => state.stack.length > 0,
    current: (state): ChainInfoTarget | null => state.stack[state.stack.length - 1] ?? null,
    canGoBack: (state): boolean => state.stack.length > 1,
  },

  actions: {
    /** Открыть модалку заново — с этой записью. */
    open(target: ChainInfoTarget, options: { onLeave?: () => void } = {}): void {
      if (!isValid(target)) return
      onLeave = options.onLeave ?? null
      this.stack = [target]
    },

    /** Перейти внутри модалки; та же запись повторно не кладётся. */
    push(target: ChainInfoTarget): void {
      if (!isValid(target)) return
      if (!this.stack.length) {
        this.stack = [target]
        return
      }
      const top = this.stack[this.stack.length - 1]!
      if (sameTarget(top, target)) return
      this.stack = [...this.stack, target].slice(-CHAIN_INFO_MAX_DEPTH)
    },

    back(): void {
      if (this.stack.length > 1) this.stack = this.stack.slice(0, -1)
    },

    close(): void {
      onLeave = null
      this.stack = []
    },

    /** Ушли из модалки на другую страницу приложения. */
    leave(): void {
      const callback = onLeave
      this.close()
      callback?.()
    },
  },
})
