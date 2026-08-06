/**
 * Optimistic-слой для ПОСТОВ (аналог comments-store.ts).
 *
 * Хранит свежеопубликованные посты (share/video/audio/article TX), которые уже
 * ушли в мемпул (у нас есть txid от sendrawtransactionwithmessage), но ещё не
 * попали в блок и не отдаются лентой. Такой пост показывается:
 *   - в ленте профиля автора — ТОЛЬКО ему, с пометкой «не опубликовано в блокчейне»
 *     (см. use-profile-feed + pending-post-adapter);
 *   - в шапке в выпадашке «песочных часов» (см. header-events.vue).
 *
 * Ключевание по адресу автора (в отличие от comments-store, где ключ — postId),
 * потому что pending-пост принадлежит ленте конкретного профиля.
 *
 * Снятие pending происходит, когда пост подтверждён сетью:
 *   - WS-событие `transaction` с типом поста → applyConfirmedTx(txid) (мгновенно);
 *   - reconcileWithServer(address, txids) при загрузке ленты (пост уже виден в RPC);
 *   - cleanupExpired по TTL (страховка, если подтверждение не пришло).
 */

import { defineStore } from 'pinia'
import type { SharePostOperationType } from '@/blockchain/core/actions/post-action'

/** Локальный pending-пост (свежеотправленный, ещё не в getprofilefeed). */
export interface PendingPost {
  /** txid из sendrawtransactionwithmessage — используется как ключ и id поста */
  id: string
  /** Адрес автора (текущий пользователь) — ключ ленты профиля */
  address: string
  /** Заголовок (caption) */
  caption: string
  /** Тело поста (для сниппета в шапке и превью в карточке) */
  message: string
  /** Картинки (URL после загрузки; для мгновенного превью годятся и base64) */
  images: string[]
  /** Теги */
  tags: string[]
  /** URL видео/аудио (peertube://…) — если это видео/аудио-пост */
  url?: string
  /** Тип операции — для рендера видео/аудио-карточки и матча WS-события */
  type: SharePostOperationType
  /** Время локальной отправки (мс) */
  createdAt: number
  /** TTL pending в локальном кеше (по умолчанию 10 мин) */
  expiresAt: number
}

export const PENDING_POST_TTL_MS = 10 * 60 * 1000

export const usePendingPostsStore = defineStore('pending-posts', {
  state: () => ({
    /**
     * address → массив pending-постов автора.
     * Снимается при подтверждении из RPC/WS либо по TTL.
     */
    pendingByAddress: {} as Record<string, PendingPost[]>,
  }),

  getters: {
    /** Pending-посты для конкретного адреса (свежие в начале). */
    getPendingForAddress(state) {
      return (address: string): PendingPost[] => {
        const list = state.pendingByAddress[address] ?? []
        // Свежие сверху — как в ленте (desc по времени).
        return [...list].sort((a, b) => b.createdAt - a.createdAt)
      }
    },
    /** Общее число pending-постов по всем адресам — для индикатора в шапке. */
    pendingCount(state): number {
      let n = 0
      for (const list of Object.values(state.pendingByAddress)) n += list.length
      return n
    },
    /** Плоский список pending-постов по всем адресам — для дропдауна шапки. */
    allPending(state): PendingPost[] {
      const out: PendingPost[] = []
      for (const list of Object.values(state.pendingByAddress)) {
        for (const p of list) out.push(p)
      }
      return out.sort((a, b) => b.createdAt - a.createdAt)
    },
  },

  actions: {
    /** Регистрирует свежеотправленный пост как pending (id = txid). */
    addPending(post: PendingPost): void {
      const list = this.pendingByAddress[post.address] ?? []
      // Защита от дубля по id.
      const filtered = list.filter((p) => p.id !== post.id)
      this.pendingByAddress = {
        ...this.pendingByAddress,
        [post.address]: [...filtered, post],
      }
    },

    /** Снимает конкретный pending-пост по адресу и id. */
    removePending(address: string, id: string): void {
      const list = this.pendingByAddress[address]
      if (!list) return
      const next = list.filter((p) => p.id !== id)
      if (next.length === list.length) return
      if (next.length === 0) {
        const cp = { ...this.pendingByAddress }
        delete cp[address]
        this.pendingByAddress = cp
      } else {
        this.pendingByAddress = { ...this.pendingByAddress, [address]: next }
      }
    },

    /**
     * Согласовать с тем, что пришло из getprofilefeed: если pending-пост уже виден
     * среди реальных постов ленты (его txid в наборе) — снять pending.
     */
    reconcileWithServer(address: string, serverTxids: Set<string>): void {
      const list = this.pendingByAddress[address]
      if (!list || list.length === 0) return
      for (const p of list) {
        if (serverTxids.has(p.id)) this.removePending(address, p.id)
      }
    },

    /**
     * Применить подтверждение TX из WS: снять pending по txid во всех адресах
     * (адрес заранее неизвестен подписчику; практически это всегда наш адрес).
     */
    applyConfirmedTx(txid: string): void {
      if (!txid) return
      for (const [address, list] of Object.entries(this.pendingByAddress)) {
        if (list.some((p) => p.id === txid)) this.removePending(address, txid)
      }
    },

    /** Удаляет просроченные pending по всем адресам (TTL-страховка). */
    cleanupExpired(now: number = Date.now()): void {
      let dirty = false
      const next: Record<string, PendingPost[]> = {}
      for (const [address, list] of Object.entries(this.pendingByAddress)) {
        const live = list.filter((p) => p.expiresAt > now)
        if (live.length !== list.length) dirty = true
        if (live.length > 0) next[address] = live
      }
      if (dirty) this.pendingByAddress = next
    },

    /** Полный сброс (на logout / смену пользователя). */
    reset(): void {
      this.pendingByAddress = {}
    },
  },
})
