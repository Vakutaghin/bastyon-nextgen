/**
 * Optimistic-слой для ПОСТОВ (аналог comments-store.ts).
 *
 * Хранит свежеопубликованные посты (share/video/audio/article TX), которые уже
 * ушли в мемпул (у нас есть txid от sendrawtransactionwithmessage), но ещё не
 * отдаются лентой. Такой пост показывается:
 *   - в ленте профиля автора — ТОЛЬКО ему, с пометкой «не опубликовано в блокчейне»
 *     (см. use-profile-feed + pending-post-adapter);
 *   - в шапке в выпадашке «песочных часов» (см. header-events.vue).
 *
 * Ключевание по адресу автора (в отличие от comments-store, где ключ — postId),
 * потому что pending-пост принадлежит ленте конкретного профиля.
 *
 * Попал ли пост в блок, следит pending-transactions-store — как за всеми
 * транзакциями аккаунта: WS, опрос ноды, проверка на каждом новом блоке. Раньше
 * пост ждал только события WS: пропущенное событие оставляло «не опубликовано»
 * до перезапуска, а через 10 минут пост молча пропадал из ленты профиля.
 *   - в блоке → `confirmedAt`: пометка снимается сразу, пост остаётся в ленте
 *     профиля, пока нода не отдаст его сама (её индекс бывает на шаг позади);
 *   - за час (отложенный — за час после своего времени) так и не попал в блок →
 *     `failed`: пост остаётся с пометкой и текстом, пока автор его не уберёт;
 *   - лента профиля отдала пост (reconcileWithServer) — запись не нужна.
 * Записи хранятся по аккаунтам в localStorage: ожидание переживает перезапуск.
 */

import { defineStore } from 'pinia'
import type { SharePostOperationType } from '@/blockchain/core/actions/post-action'
import { onTransactionSettled } from '@/blockchain/core/transactions/broadcast-events'
import { PENDING_TX_TTL_MS } from '@/stores/pending-transactions-store'

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
  /** Тип операции — для рендера видео/аудио-карточки */
  type: SharePostOperationType
  /** Время локальной отправки (мс) */
  createdAt: number
  /** Отложенная публикация: в блок попадёт не раньше этого времени (мс). */
  scheduledAt?: number
  /** Когда ждать перестаём и считаем, что в блок пост не попал (мс). */
  expiresAt: number
  /** Пост в блоке — когда это стало известно (мс). */
  confirmedAt?: number
  /** В блок так и не попал. */
  failed?: boolean
}

/** Ждём блока на 10 минут дольше, чем pending-transactions-store: решает он. */
export const PENDING_POST_TTL_MS = PENDING_TX_TTL_MS + 10 * 60 * 1000
/** Пост в блоке, а лента профиля его ещё не отдала: держим не дольше. */
export const CONFIRMED_KEEP_MS = 10 * 60 * 1000
/** Не попавший в блок пост сам уходит через неделю, если автор его не убрал. */
export const FAILED_KEEP_MS = 7 * 24 * 60 * 60 * 1000

const STORAGE_PREFIX = 'BST_PENDING_POSTS_'

/** До какого времени ждать блока: от отправки или от запланированного времени. */
export function pendingPostDeadline(createdAt: number, scheduledAt?: number): number {
  return Math.max(createdAt, scheduledAt ?? 0) + PENDING_POST_TTL_MS
}

function readStored(address: string): PendingPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + address)
    const list = raw ? (JSON.parse(raw) as PendingPost[]) : []
    return Array.isArray(list)
      ? list.filter((p) => p && typeof p.id === 'string' && p.address === address)
      : []
  } catch {
    return []
  }
}

function writeStored(address: string, list: PendingPost[]): void {
  try {
    // base64-картинки (если загрузка их не заменила) в хранилище не кладём.
    const slim = list.map((p) => ({ ...p, images: p.images.filter((i) => !i.startsWith('data:')) }))
    if (slim.length) localStorage.setItem(STORAGE_PREFIX + address, JSON.stringify(slim))
    else localStorage.removeItem(STORAGE_PREFIX + address)
  } catch {
    // Хранилище недоступно — ожидание живёт до перезапуска.
  }
}

/** Ещё ждёт блока: не подтверждён и не сорвался. */
const isWaiting = (p: PendingPost): boolean => !p.confirmedAt && !p.failed

let stopSettled: (() => void) | null = null

export const usePendingPostsStore = defineStore('pending-posts', {
  state: () => ({
    /**
     * address → массив pending-постов автора.
     * Снимается, когда лента профиля отдала пост, или автором (не попавший в блок).
     */
    pendingByAddress: {} as Record<string, PendingPost[]>,
  }),

  getters: {
    /** Pending-посты для конкретного адреса (свежие в начале), в том числе подтверждённые. */
    getPendingForAddress(state) {
      return (address: string): PendingPost[] => {
        const list = state.pendingByAddress[address] ?? []
        // Свежие сверху — как в ленте (desc по времени).
        return [...list].sort((a, b) => b.createdAt - a.createdAt)
      }
    },
    /** Сколько постов ждут блока — для индикатора в шапке. */
    pendingCount(state): number {
      let n = 0
      for (const list of Object.values(state.pendingByAddress)) n += list.filter(isWaiting).length
      return n
    },
    /** Посты, ждущие блока, по всем адресам — для дропдауна шапки. */
    allPending(state): PendingPost[] {
      const out: PendingPost[] = []
      for (const list of Object.values(state.pendingByAddress)) {
        for (const p of list) if (isWaiting(p)) out.push(p)
      }
      return out.sort((a, b) => b.createdAt - a.createdAt)
    },
  },

  actions: {
    /**
     * Посты аккаунта с прошлого запуска и подписка на исход транзакций. Зовётся
     * при каждой смене адреса (header-events).
     */
    init(address: string | null): void {
      if (!stopSettled) {
        // Стор — на момент события, а не подписки: подписка одна на модуль.
        stopSettled = onTransactionSettled((txid, confirmed) => {
          const store = usePendingPostsStore()
          if (confirmed) store.applyConfirmedTx(txid)
          else store.markFailed(txid)
        })
      }
      if (!address) return
      const stored = readStored(address)
      if (!stored.length) return
      const current = this.pendingByAddress[address] ?? []
      const known = new Set(current.map((p) => p.id))
      this.pendingByAddress = {
        ...this.pendingByAddress,
        [address]: [...current, ...stored.filter((p) => !known.has(p.id))],
      }
      this.cleanupExpired()
    },

    /** Записать посты адреса как есть сейчас. */
    persist(address: string): void {
      writeStored(address, this.pendingByAddress[address] ?? [])
    },

    /** Регистрирует свежеотправленный пост как pending (id = txid). */
    addPending(post: PendingPost): void {
      const list = this.pendingByAddress[post.address] ?? []
      // Защита от дубля по id.
      const filtered = list.filter((p) => p.id !== post.id)
      this.pendingByAddress = {
        ...this.pendingByAddress,
        [post.address]: [...filtered, post],
      }
      this.persist(post.address)
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
      this.persist(address)
    },

    /** Изменить пост с этим txid, где бы он ни лежал. */
    patchTx(txid: string, patch: Partial<PendingPost>): void {
      if (!txid) return
      for (const [address, list] of Object.entries(this.pendingByAddress)) {
        const index = list.findIndex((p) => p.id === txid)
        if (index === -1) continue
        const next = list.slice()
        next[index] = { ...next[index]!, ...patch }
        this.pendingByAddress = { ...this.pendingByAddress, [address]: next }
        this.persist(address)
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

    /** Ждём ли блока для поста с таким txid. */
    hasPendingTx(txid: string): boolean {
      if (!txid) return false
      return Object.values(this.pendingByAddress).some((list) =>
        list.some((p) => p.id === txid && isWaiting(p))
      )
    },

    /**
     * Пост в блоке (WS или проверка ноды). Пометка снимается, а сам пост
     * остаётся в ленте профиля, пока она его не отдаст: иначе он пропадал до
     * следующей загрузки, если нода ещё не успела его проиндексировать.
     */
    applyConfirmedTx(txid: string): void {
      const post = this.findTx(txid)
      if (!post || post.confirmedAt) return
      this.patchTx(txid, { confirmedAt: Date.now(), failed: false })
    },

    /** Пост так и не попал в блок. */
    markFailed(txid: string): void {
      const post = this.findTx(txid)
      if (!post || !isWaiting(post)) return
      this.patchTx(txid, { failed: true })
    },

    /** Убрать пост, не попавший в блок (кнопка на карточке). */
    dismiss(txid: string): void {
      const post = this.findTx(txid)
      if (post) this.removePending(post.address, txid)
    },

    findTx(txid: string): PendingPost | undefined {
      if (!txid) return undefined
      for (const list of Object.values(this.pendingByAddress)) {
        const post = list.find((p) => p.id === txid)
        if (post) return post
      }
      return undefined
    },

    /**
     * Подчистка по времени: подтверждённый пост, которого лента так и не
     * отдала, уходит через 10 минут; ждущий дольше срока считается не попавшим
     * в блок (страховка: решает pending-transactions-store); не попавший в блок
     * уходит через неделю.
     */
    cleanupExpired(now: number = Date.now()): void {
      for (const [address, list] of Object.entries(this.pendingByAddress)) {
        let dirty = false
        const next: PendingPost[] = []
        for (const p of list) {
          if (p.confirmedAt && now - p.confirmedAt > CONFIRMED_KEEP_MS) {
            dirty = true
          } else if (p.failed && now - p.createdAt > FAILED_KEEP_MS) {
            dirty = true
          } else if (isWaiting(p) && p.expiresAt <= now) {
            dirty = true
            next.push({ ...p, failed: true })
          } else {
            next.push(p)
          }
        }
        if (!dirty) continue
        const cp = { ...this.pendingByAddress }
        if (next.length) cp[address] = next
        else delete cp[address]
        this.pendingByAddress = cp
        this.persist(address)
      }
    },

    /** Полный сброс (на logout / смену пользователя); сохранённое остаётся аккаунту. */
    reset(): void {
      this.pendingByAddress = {}
    },
  },
})
