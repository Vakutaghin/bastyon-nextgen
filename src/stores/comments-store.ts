/**
 * Optimistic-слой для комментариев.
 *
 * Хранит локальные правки UI, которые должны переживать перерендер компонента
 * `post-card-comments` и быть согласованы между несколькими экземплярами поста
 * (на странице ленты + в карточке профиля и т.п.):
 *
 *   - editedMessages    — overrides текста после успешного commentEdit TX
 *   - deletedCommentIds — set свежеудалённых комментариев (commentDelete TX)
 *   - pendingCreates    — свежеотправленные комменты (comment TX), ждущие подтверждения
 *
 * Очистка локального оверрайда происходит, когда мы получаем подтверждение из
 * сети — либо через WS-событие `transaction` (см. `applyConfirmedTx`), либо
 * через ручной refresh, который заменит данные с RPC.
 *
 * Аналог: legacy components/comments/index.js — clbks.post / clbks.upvote +
 * actionListeners (index.js:2787-2812). У нас разделено: confirm-логика в сторе,
 * сетевые подписки — в слое подключения (см. `useCommentsRealtime` ниже / Phase 2.C).
 */

import { defineStore } from 'pinia'
import type { GetComment } from '@/types/rpc-responses/get-comments'

/** Локальный pending-комментарий (свежеотправленный, ещё не в getcomments) */
export interface PendingComment {
  /** Локальный id (txid вернувшийся от sendrawtransactionwithmessage), используется как ключ */
  id: string
  /** txid поста */
  postId: string
  /** Текст */
  message: string
  /** ID родительского комментария ветки (пусто для корневого) */
  parentId: string
  /** ID комментария, на который отвечаем (пусто для корневого) */
  answerId: string
  /** Адрес автора (текущего пользователя) */
  address: string
  /** Время локальной отправки (мс) */
  createdAt: number
  /** Срок жизни pending в локальном кеше (по умолчанию 10 мин) */
  expiresAt: number
}

const PENDING_TTL_MS = 10 * 60 * 1000

export const useCommentsStore = defineStore('comments', {
  state: () => ({
    /** commentId → новый текст (после commentEdit) */
    editedMessages: {} as Record<string, string>,
    /** commentId → true (после commentDelete TX, до подтверждения сетью) */
    deletedCommentIds: {} as Record<string, true>,
    /**
     * postId → массив pending-комментариев.
     * При получении подтверждения из RPC/WS — конкретный pending удаляется.
     */
    pendingCreates: {} as Record<string, PendingComment[]>,
    /**
     * Множество comment-id, для которых пользователь нажал «Показать всё равно»
     * на скрытом-по-репутации комментарии. Действует до перезагрузки страницы.
     */
    revealedHiddenIds: {} as Record<string, true>,
  }),

  getters: {
    /** Получить override-текст по id; null если нет */
    getEditedMessage(state) {
      return (commentId: string): string | null => {
        const v = state.editedMessages[commentId]
        return typeof v === 'string' ? v : null
      }
    },
    /** Помечен ли комментарий как удалённый (локально) */
    isLocallyDeleted(state) {
      return (commentId: string): boolean => state.deletedCommentIds[commentId] === true
    },
    /** Список pending комментов для поста (сортировка по createdAt — свежие в конце) */
    getPendingForPost(state) {
      return (postId: string): PendingComment[] => state.pendingCreates[postId] ?? []
    },
    /** Раскрыт ли скрытый комментарий пользователем */
    isRevealed(state) {
      return (commentId: string): boolean => state.revealedHiddenIds[commentId] === true
    },
  },

  actions: {
    // --- Edit ---
    setEditedMessage(commentId: string, text: string): void {
      this.editedMessages = { ...this.editedMessages, [commentId]: text }
    },
    clearEditedMessage(commentId: string): void {
      if (!(commentId in this.editedMessages)) return
      const next = { ...this.editedMessages }
      delete next[commentId]
      this.editedMessages = next
    },

    // --- Delete ---
    markDeleted(commentId: string): void {
      this.deletedCommentIds = { ...this.deletedCommentIds, [commentId]: true }
    },
    unmarkDeleted(commentId: string): void {
      if (!this.deletedCommentIds[commentId]) return
      const next = { ...this.deletedCommentIds }
      delete next[commentId]
      this.deletedCommentIds = next
    },

    // --- Pending creates ---
    /**
     * Регистрирует свежеотправленный комментарий как pending.
     * Возвращается, пока не придёт подтверждение или не истечёт TTL.
     */
    addPending(comment: PendingComment): void {
      const list = this.pendingCreates[comment.postId] ?? []
      // Защита от дубля по id
      const filtered = list.filter((c) => c.id !== comment.id)
      this.pendingCreates = {
        ...this.pendingCreates,
        [comment.postId]: [...filtered, comment],
      }
    },
    removePending(postId: string, commentId: string): void {
      const list = this.pendingCreates[postId]
      if (!list) return
      const next = list.filter((c) => c.id !== commentId)
      if (next.length === list.length) return
      if (next.length === 0) {
        const cp = { ...this.pendingCreates }
        delete cp[postId]
        this.pendingCreates = cp
      } else {
        this.pendingCreates = { ...this.pendingCreates, [postId]: next }
      }
    },
    /** Удаляет просроченные pending по всем постам (TTL) */
    cleanupExpired(now: number = Date.now()): void {
      let dirty = false
      const next: Record<string, PendingComment[]> = {}
      for (const [postId, list] of Object.entries(this.pendingCreates)) {
        const live = list.filter((c) => c.expiresAt > now)
        if (live.length !== list.length) dirty = true
        if (live.length > 0) next[postId] = live
      }
      if (dirty) this.pendingCreates = next
    },

    // --- Sync с RPC-данными ---
    /**
     * Согласовать локальный оверрайд с тем, что пришло из getcomments:
     *   - если editedMessage соответствует серверной версии (или сервер свежее) — сбросить override
     *   - если pending с тем же id присутствует среди реальных комментов — снять pending
     *   - если deleted-флаг подтверждён сервером — снять локальную метку
     */
    reconcileWithServer(postId: string, serverComments: GetComment[]): void {
      const byId = new Map<string, GetComment>()
      for (const c of serverComments) byId.set(c.id, c)

      // 1) editedMessages: если сервер вернул свежий текст (после нашего edit), снимаем override
      for (const [commentId, overrideText] of Object.entries(this.editedMessages)) {
        const server = byId.get(commentId)
        if (!server) continue
        const serverText = parseServerMessageText(server.msg)
        // Сервер свежее, либо текст уже совпал — сбрасываем
        if (serverText === overrideText) {
          this.clearEditedMessage(commentId)
        } else if (server.timeUpd > 0 && server.edit) {
          // Сервер уже знает о редактуре — даже если текст не совпал (последняя версия другая),
          // лучше довериться серверу и снять оверрайд
          this.clearEditedMessage(commentId)
        }
      }

      // 2) deletedCommentIds: если сервер уже отдаёт этот коммент как deleted — снимаем
      for (const commentId of Object.keys(this.deletedCommentIds)) {
        const server = byId.get(commentId)
        if (server?.deleted) this.unmarkDeleted(commentId)
      }

      // 3) pendingCreates: если pending уже виден среди реальных — снимаем
      const pending = this.pendingCreates[postId]
      if (pending && pending.length > 0) {
        for (const p of pending) if (byId.has(p.id)) this.removePending(postId, p.id)
      }
    },

    /**
     * Применить подтверждение конкретной TX, пришедшей из WS.
     * `txid` — id подтверждённой транзакции; `optype` — тип операции, если известен.
     *
     * NB: одного txid недостаточно для гарантированного матча с локальной optimistic-записью,
     * потому что локально мы тоже ключуем по txid от sendrawtransactionwithmessage. Если матч
     * по id найден — снимаем соответствующий локальный флаг.
     */
    applyConfirmedTx(postId: string, txid: string, optype?: string): void {
      if (!txid) return
      // Pending create — снимаем
      this.removePending(postId, txid)
      // Edit — снимаем override (сервер должен отдать новый текст в getcomments)
      if (optype === 'commentEdit' || !optype) this.clearEditedMessage(txid)
      // Delete — снимаем локальную метку (сервер пометит deleted)
      if (optype === 'commentDelete' || !optype) this.unmarkDeleted(txid)
    },

    // --- Reveal hidden ---
    revealHidden(commentId: string): void {
      if (this.revealedHiddenIds[commentId]) return
      this.revealedHiddenIds = { ...this.revealedHiddenIds, [commentId]: true }
    },

    /** Полный сброс локального стейта (на logout / смену пользователя) */
    reset(): void {
      this.editedMessages = {}
      this.deletedCommentIds = {}
      this.pendingCreates = {}
      this.revealedHiddenIds = {}
    },
  },
})

/** Извлекает текст из поля msg (JSON-строка либо plain). Дублирует logic из helpers.ts. */
function parseServerMessageText(msg: string): string {
  try {
    const parsed = JSON.parse(msg) as { message?: string }
    return parsed?.message ?? msg
  } catch {
    return msg
  }
}
