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
 *   - myVotes           — свои лайки и дизлайки (cScore TX), пока список их не отдал
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
import { onTransactionSettled } from '@/blockchain/core/transactions/broadcast-events'
import { PENDING_TX_TTL_MS } from '@/stores/pending-transactions-store'

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
  /** Когда ждать перестаём и считаем, что в блок комментарий не попал (мс). */
  expiresAt: number
  /** Заголовок поста (snapshot на момент отправки) — для дропдауна шапки */
  postTitle?: string
  /** В блоке — когда это стало известно (мс); виден без часов, пока список его не отдаст. */
  confirmedAt?: number
  /** В блок так и не попал: пометка «Ошибка» до перезагрузки. */
  failed?: boolean
}

/**
 * Сколько ждать блока. Решает pending-transactions-store (час): здесь на 10
 * минут дольше — страховка. Раньше через 10 минут комментарий молча пропадал,
 * даже если потом попадал в блок.
 */
export const PENDING_COMMENT_TTL_MS = PENDING_TX_TTL_MS + 10 * 60 * 1000
/** Комментарий в блоке, а список его ещё не отдал: держим не дольше. */
const CONFIRMED_KEEP_MS = 10 * 60 * 1000

/** Ещё ждёт блока: не подтверждён и не сорвался. */
const isWaiting = (c: PendingComment): boolean => !c.confirmedAt && !c.failed

let stopSettled: (() => void) | null = null

export const useCommentsStore = defineStore('comments', {
  state: () => ({
    /** commentId → новый текст (после commentEdit) */
    editedMessages: {} as Record<string, string>,
    /**
     * txid транзакции правки/удаления → id комментария. WS приносит только
     * txid самой транзакции, а оверрайды лежат по id комментария — без этой
     * карты подтверждение снимало не то, что нужно (S19).
     */
    txToCommentId: {} as Record<string, string>,
    /** commentId → true (после commentDelete TX, до подтверждения сетью) */
    deletedCommentIds: {} as Record<string, true>,
    /**
     * postId → массив pending-комментариев. Снимается, когда getcomments отдал
     * комментарий; в блоке — `confirmedAt`, не попал — `failed`.
     */
    pendingCreates: {} as Record<string, PendingComment[]>,
    /**
     * postId → счётчик: свой комментарий к посту попал в блок. Открытый список
     * (use-comments-ws) по нему перезагружается.
     */
    confirmedTick: {} as Record<string, number>,
    /**
     * Множество comment-id, для которых пользователь нажал «Показать всё равно»
     * на скрытом-по-репутации комментарии. Действует до перезагрузки страницы.
     */
    revealedHiddenIds: {} as Record<string, true>,
    /**
     * «адрес|commentId» → своя оценка. Нода отдаёт её в myScore и учитывает в
     * scoreUp/scoreDown только после блока, а до того отметку и +1 держит этот
     * слой — одинаково во всех местах, где виден комментарий, и после
     * перерисовки карточки. Сбрасывается, если транзакция в блок не попала.
     */
    myVotes: {} as Record<string, { value: 1 | -1; txid?: string }>,
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
    /** Сколько комментариев ждут блока — для индикатора в шапке */
    pendingCount(state): number {
      let n = 0
      for (const list of Object.values(state.pendingCreates)) n += list.filter(isWaiting).length
      return n
    },
    /** Комментарии, ждущие блока, по всем постам — для дропдауна шапки */
    allPending(state): PendingComment[] {
      const out: PendingComment[] = []
      for (const list of Object.values(state.pendingCreates)) {
        for (const c of list) if (isWaiting(c)) out.push(c)
      }
      return out
    },
    /** Своя оценка комментария из этой сессии; null — не ставили. */
    myVoteOf(state) {
      return (address: string, commentId: string): 1 | -1 | null =>
        state.myVotes[voteKey(address, commentId)]?.value ?? null
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
    /**
     * Заменить локальный временный id pending-комментария на реальный txid,
     * полученный от sendrawtransactionwithmessage. Нужно, чтобы reconcileWithServer
     * корректно дедуплицировал запись, когда серверный комментарий с тем же txid
     * прилетит из getcomments.
     */
    replacePendingId(postId: string, oldId: string, newId: string): void {
      if (oldId === newId) return
      const list = this.pendingCreates[postId]
      if (!list) return
      const idx = list.findIndex((c) => c.id === oldId)
      if (idx === -1) return
      const next = list.slice()
      next[idx] = { ...next[idx], id: newId }
      this.pendingCreates = { ...this.pendingCreates, [postId]: next }
    },
    /**
     * Подчистка по времени: ждущий дольше срока считается не попавшим в блок,
     * подтверждённый, которого список так и не отдал, уходит через 10 минут.
     */
    cleanupExpired(now: number = Date.now()): void {
      let dirty = false
      const next: Record<string, PendingComment[]> = {}
      for (const [postId, list] of Object.entries(this.pendingCreates)) {
        const live: PendingComment[] = []
        for (const c of list) {
          if (c.confirmedAt && now - c.confirmedAt > CONFIRMED_KEEP_MS) {
            dirty = true
          } else if (isWaiting(c) && c.expiresAt <= now) {
            dirty = true
            live.push({ ...c, failed: true })
          } else {
            live.push(c)
          }
        }
        if (live.length > 0) next[postId] = live
      }
      if (dirty) this.pendingCreates = next
    },

    /** Подписка на исход транзакций (pending-transactions-store); зовёт header-events. */
    init(): void {
      if (stopSettled) return
      // Стор — на момент события, а не подписки: подписка одна на модуль.
      stopSettled = onTransactionSettled((txid, confirmed) => {
        const store = useCommentsStore()
        if (confirmed) store.markCreateConfirmed(txid)
        else {
          store.markCreateFailed(txid)
          store.dropVoteByTx(txid)
        }
      })
    },

    /** Пост, к которому относится свой новый комментарий с этим txid. */
    postOfCreate(txid: string): string | null {
      if (!txid) return null
      for (const [postId, list] of Object.entries(this.pendingCreates)) {
        if (list.some((c) => c.id === txid)) return postId
      }
      return null
    },

    patchCreate(postId: string, txid: string, patch: Partial<PendingComment>): void {
      const list = this.pendingCreates[postId]
      const index = list?.findIndex((c) => c.id === txid) ?? -1
      if (!list || index === -1) return
      const next = list.slice()
      next[index] = { ...next[index]!, ...patch }
      this.pendingCreates = { ...this.pendingCreates, [postId]: next }
    },

    /**
     * Свой новый комментарий в блоке: часы снимаются сразу, а сам он остаётся,
     * пока список комментариев его не отдаст — открытый список перезагрузится.
     */
    markCreateConfirmed(txid: string): void {
      const postId = this.postOfCreate(txid)
      if (!postId) return
      const comment = this.pendingCreates[postId]!.find((c) => c.id === txid)!
      if (comment.confirmedAt) return
      this.patchCreate(postId, txid, { confirmedAt: Date.now(), failed: false })
      this.confirmedTick = {
        ...this.confirmedTick,
        [postId]: (this.confirmedTick[postId] ?? 0) + 1,
      }
    },

    /** Свой новый комментарий так и не попал в блок. */
    markCreateFailed(txid: string): void {
      const postId = this.postOfCreate(txid)
      if (!postId) return
      const comment = this.pendingCreates[postId]!.find((c) => c.id === txid)!
      if (isWaiting(comment)) this.patchCreate(postId, txid, { failed: true })
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
    /** Ждём ли подтверждения этой транзакции: pending-комментарий или правка/удаление. */
    hasPendingTx(postId: string, txid: string): boolean {
      if (!txid) return false
      if (this.txToCommentId[txid]) return true
      return (this.pendingCreates[postId] ?? []).some((p) => p.id === txid && isWaiting(p))
    },

    /** Запоминает, какой комментарий правила/удаляла транзакция `txid` (S19). */
    rememberTxForComment(txid: string, commentId: string): void {
      if (!txid || !commentId) return
      this.txToCommentId = { ...this.txToCommentId, [txid]: commentId }
    },

    applyConfirmedTx(postId: string, txid: string, optype?: string): void {
      if (!txid) return
      // Новый комментарий — в блоке; уберёт его сверка со списком.
      this.markCreateConfirmed(txid)
      // Оверрайды лежат по id комментария; txid правки/удаления переводим
      // через карту, а сам txid оставляем как запасной ключ (S19).
      const commentId = this.txToCommentId[txid]
      if (optype === 'commentEdit' || !optype) {
        this.clearEditedMessage(commentId ?? txid)
        if (commentId) this.clearEditedMessage(txid)
      }
      if (optype === 'commentDelete' || !optype) {
        this.unmarkDeleted(commentId ?? txid)
        if (commentId) this.unmarkDeleted(txid)
      }
      if (commentId) {
        const next = { ...this.txToCommentId }
        delete next[txid]
        this.txToCommentId = next
      }
    },

    // --- Score ---
    setMyVote(address: string, commentId: string, value: 1 | -1, txid?: string): void {
      this.myVotes = { ...this.myVotes, [voteKey(address, commentId)]: { value, txid } }
    },
    clearMyVote(address: string, commentId: string): void {
      const key = voteKey(address, commentId)
      if (!this.myVotes[key]) return
      const next = { ...this.myVotes }
      delete next[key]
      this.myVotes = next
    },
    /** Оценка так и не попала в блок — отметку снимаем. */
    dropVoteByTx(txid: string): void {
      const keys = Object.keys(this.myVotes).filter((k) => this.myVotes[k]?.txid === txid)
      if (!keys.length) return
      const next = { ...this.myVotes }
      for (const k of keys) delete next[k]
      this.myVotes = next
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
      this.confirmedTick = {}
      this.revealedHiddenIds = {}
      this.txToCommentId = {}
      this.myVotes = {}
    },
  },
})

function voteKey(address: string, commentId: string): string {
  return `${address}|${commentId}`
}

/** Извлекает текст из поля msg (JSON-строка либо plain). Дублирует logic из helpers.ts. */
function parseServerMessageText(msg: string): string {
  try {
    const parsed = JSON.parse(msg) as { message?: string }
    return parsed?.message ?? msg
  } catch {
    return msg
  }
}
