import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCall, rpcCallArrayWithAuth, rpcCallWithAuth } from '@/helpers/api/request'
import { settingsAPI, } from '@/db/apis/settings-api'
import { notificationsAPI } from '@/db/apis/notifications-api'
import { generateCacheHash } from '@/helpers/common/cache-hash'
import type { GetMissedInfoParameters } from '@/types/rpc-requests/get-missed-info'
import type { GetMissedInfoBlockItem, GetMissedInfoEventItem, GetMissedInfoDataItem } from '@/types/rpc-responses/get-missed-info'
import type { GetNodeInfoData } from '@/types/rpc-responses/get-node-info'
import type { UserProfile } from '@/types/rpc-responses/user-get'

const NOTIFICATIONS_LAST_BLOCK_KEY = 'notificationsLastBlock'
const NOTIFICATIONS_HIDDEN_IDS_KEY = 'notificationsHiddenIds'

/** В IDB settings: { [address]: block } */
type LastBlockByAddress = Record<string, number>
/** В IDB settings: { [address]: id[] } — скрытые пользователем уведомления */
type HiddenIdsByAddress = Record<string, string[]>

/**
 * Запрос уведомлений: getmissedinfo(address, block, limit).
 * Ответ data: [BlockItem, ...EventItem[]]; события маппятся в NotificationItem.
 * Блок для следующего запроса сохраняем в IDB при открытии выпадашки (все прочитаны).
 */

const MES_TYPE_TITLES: Record<string, string> = {
  upvoteShare: 'Оценка поста',
  subscribe: 'Новый подписчик',
  unsubscribe: 'Отписка',
  subscribePrivate: 'Приватная подписка',
  answer: 'Ответ на комментарий',
  post: 'Новый пост',
  userInfo: 'Обновление профиля',
  comment: 'Комментарий',
  repost: 'Репост'
}

function pickStr(o: Record<string, unknown> | undefined | null, ...keys: string[]): string | undefined {
  if (!o) return undefined
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}

function pickArr<T = unknown>(o: Record<string, unknown> | undefined | null, ...keys: string[]): T[] | undefined {
  if (!o) return undefined
  for (const k of keys) {
    const v = o[k]
    if (Array.isArray(v)) return v as T[]
  }
  return undefined
}

/**
 * RPC `getmissedinfo` иногда прикладывает связанные сущности к событию: `share` (пост), `comment`, `user`.
 * Сохраняем их в snapshot — это даёт превью без дополнительных запросов и позволяет сразу открыть PostModal.
 */
function extractPostSnapshot(raw: unknown, fallbackTxid?: string): NotificationPostSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const txid = pickStr(o, 'txid', 'hash', 'id') ?? fallbackTxid
  if (!txid) return undefined
  return {
    txid,
    caption: pickStr(o, 'c', 'caption', 'title'),
    message: pickStr(o, 'm', 'message', 'text'),
    type: pickStr(o, 'type'),
    images: pickArr<string>(o, 'i', 'images')
  }
}

function extractCommentSnapshot(raw: unknown, fallbackId?: string, fallbackPostId?: string): NotificationCommentSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const id = pickStr(o, 'id', 'txid') ?? fallbackId
  if (!id) return undefined
  let message: string | undefined
  const msgRaw = o.msg ?? o.message
  if (typeof msgRaw === 'string') {
    try {
      const parsed = JSON.parse(msgRaw) as { message?: string }
      message = typeof parsed?.message === 'string' ? parsed.message : msgRaw
    } catch {
      message = msgRaw
    }
  } else if (msgRaw && typeof msgRaw === 'object') {
    const inner = (msgRaw as Record<string, unknown>).message
    if (typeof inner === 'string') message = inner
  }
  return {
    id,
    postid: pickStr(o, 'postid', 'rootTxHash', 'posttxid') ?? fallbackPostId,
    parentid: pickStr(o, 'parentid'),
    answerid: pickStr(o, 'answerid'),
    address: pickStr(o, 'address'),
    message
  }
}

function extractUserSnapshot(raw: unknown, fallbackAddress?: string): NotificationUserSnapshot | undefined {
  if (!raw || typeof raw !== 'object') {
    return fallbackAddress ? { address: fallbackAddress } : undefined
  }
  const o = raw as Record<string, unknown>
  const address = pickStr(o, 'address', 'addr') ?? fallbackAddress
  if (!address) return undefined
  return {
    address,
    name: pickStr(o, 'name'),
    avatar: pickStr(o, 'i', 'avatar'),
    reputation: typeof o.reputation === 'number' ? (o.reputation as number) : undefined
  }
}

function mapMissedEventToNotification(n: GetMissedInfoEventItem | Record<string, unknown>): NotificationItem | null {
  const id = (n.txid ?? n.id ?? n.nblock ?? Math.random().toString(36)) as string
  const nblock = Number(n.nblock ?? 0) || 0
  const mesType = (n.mesType ?? n.type) as string
  const time = Number(n.time ?? n.nTime ?? n.nblock ?? 0) || Math.floor(Date.now() / 1000)
  const title = MES_TYPE_TITLES[mesType] ?? 'Уведомление'
  let description: string | undefined
  if (n.upvoteVal != null) description = `Оценка: ${n.upvoteVal}`
  const link = (n.url ?? n.link) as string | undefined
  const allowedTypes: NotificationItem['type'][] = ['comment', 'like', 'subscribe', 'repost', 'mention', 'rating', 'tip', 'other']
  const typeMap: Record<string, NotificationItem['type']> = {
    upvoteShare: 'rating',
    subscribe: 'subscribe',
    unsubscribe: 'subscribe',
    answer: 'comment',
    post: 'other',
    comment: 'comment',
    repost: 'repost'
  }
  const safeType = typeMap[mesType] ?? (allowedTypes.includes(mesType as NotificationItem['type']) ? (mesType as NotificationItem['type']) : 'other')
  const upvoteVal = n.upvoteVal != null ? Number(n.upvoteVal) : undefined
  const fromAddress = (n.addrFrom ?? (n.account as Record<string, unknown>)?.address) as string | undefined
  const shareId = (n.posttxid ?? n.rootTxHash ?? n.postHash) as string | undefined

  const postSnapshot = extractPostSnapshot(n.share, shareId)
  const commentSnapshot = extractCommentSnapshot(n.comment, String(id), shareId)
  const fromSnapshot = extractUserSnapshot(n.user, fromAddress)

  return {
    id: String(id),
    nblock,
    type: safeType,
    title: String(title),
    description,
    time,
    link,
    seen: false,
    from: fromAddress ?? fromSnapshot?.address,
    shareId,
    mesType,
    upvoteVal,
    postSnapshot,
    commentSnapshot,
    fromSnapshot
  }
}

export type NotificationType =
  | 'comment'
  | 'like'
  | 'subscribe'
  | 'repost'
  | 'mention'
  | 'rating'
  | 'tip'
  | 'other'

export interface NotificationPostSnapshot {
  txid: string
  caption?: string
  message?: string
  type?: string
  images?: string[]
}

export interface NotificationCommentSnapshot {
  id: string
  postid?: string
  parentid?: string
  answerid?: string
  address?: string
  message?: string
}

export interface NotificationUserSnapshot {
  address: string
  name?: string
  avatar?: string
  reputation?: number
}

export interface NotificationItem {
  id: string
  /** Номер блока (для указателя «прочитано до» и подсчёта непрочитанных) */
  nblock?: number
  type: NotificationType
  title: string
  description?: string
  /** Unix timestamp (seconds) */
  time: number
  /** Link for navigation (e.g. post url, profile) */
  link?: string
  seen: boolean
  /** Optional: related user address or name */
  from?: string
  /** Optional: related content id */
  shareId?: string
  /** Raw mesType from API (for filter mapping: comment, answer, upvoteShare, subscribe, ...) */
  mesType?: string
  /** For upvoteShare: rating value (positive = upvote, negative = downvote) */
  upvoteVal?: number
  /**
   * Снимок связанного контента, если RPC отдал его вместе с событием.
   * Не сохраняется в IDB — нужен только в памяти для превью.
   */
  postSnapshot?: NotificationPostSnapshot
  commentSnapshot?: NotificationCommentSnapshot
  fromSnapshot?: NotificationUserSnapshot
}

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as NotificationItem[],
    /** Скрытые пользователем id (по кнопке «Скрыть» или «Убрать все») */
    hiddenIds: new Set<string>() as Set<string>,
    loading: false,
    inited: false,
    lastBlock: 0 as number,
    /** Адрес, для которого загружали — при смене пользователя сбрасываем inited */
    initedForAddress: null as string | null,
    /** Колбэк при появлении новых уведомлений (тосты/звук). Вызывается после обновления items при опросе getmissedinfo. */
    onNewNotifications: null as ((items: NotificationItem[]) => void) | null,
    /** Кэш постов по txid — для превью и открытия PostModal */
    postCache: {} as Record<string, NotificationPostSnapshot & Record<string, unknown>>,
    /** Кэш комментариев по id (txid) — для превью и развёртывания текста */
    commentCache: {} as Record<string, NotificationCommentSnapshot & Record<string, unknown>>,
    /** Кэш профилей по адресу */
    profileCache: {} as Record<string, NotificationUserSnapshot & { profile?: UserProfile }>,
    /** Идёт фоновое обогащение — для скелетонов */
    enriching: false,
    /** id уведомлений, для которых уже запускали enrichVisible (антидубль) */
    enrichedIds: new Set<string>() as Set<string>
  }),
  getters: {
    /** Список без скрытых, по убыванию nblock/time */
    list(): NotificationItem[] {
      const filtered = this.items.filter((n) => !this.hiddenIds.has(n.id))
      return [...filtered].sort((a, b) => (b.nblock ?? b.time) - (a.nblock ?? a.time))
    },
    /** Счётчик: количество уведомлений в списке, которые не скрыты */
    unreadCount(): number {
      return this.list.length
    },
    unreadList(): NotificationItem[] {
      return this.list
    }
  },
  actions: {
    /** Высота блока из IDB для адреса (с какого блока запрашивать уведомления). */
    async loadLastBlockFromSettings(address: string): Promise<number | null> {
      try {
        const raw = await settingsAPI.get(NOTIFICATIONS_LAST_BLOCK_KEY) as LastBlockByAddress | undefined
        if (raw && typeof raw === 'object' && typeof raw[address] === 'number') {
          return raw[address]
        }
        return null
      } catch {
        return null
      }
    },

    /** Сохранить высоту блока в IDB для адреса (указатель «прочитано до» — двигаем при открытии выпадашки). */
    async saveLastBlockToSettings(address: string, block: number): Promise<void> {
      try {
        const raw = (await settingsAPI.get(NOTIFICATIONS_LAST_BLOCK_KEY)) as LastBlockByAddress | undefined
        const next: LastBlockByAddress = { ...(raw && typeof raw === 'object' ? raw : {}), [address]: block }
        await settingsAPI.set(NOTIFICATIONS_LAST_BLOCK_KEY, next)
      } catch (e) {
        console.error('[notifications] saveLastBlockToSettings failed', e)
      }
    },

    /** Загрузить скрытые id для адреса из settings. */
    async loadHiddenIdsFromSettings(address: string): Promise<Set<string>> {
      try {
        const raw = (await settingsAPI.get(NOTIFICATIONS_HIDDEN_IDS_KEY)) as HiddenIdsByAddress | undefined
        const arr = raw && typeof raw === 'object' && Array.isArray(raw[address]) ? raw[address] : []
        return new Set(arr)
      } catch {
        return new Set()
      }
    },

    /** Сохранить скрытые id для адреса в settings. */
    async saveHiddenIdsToSettings(address: string, ids: Set<string>): Promise<void> {
      try {
        const raw = (await settingsAPI.get(NOTIFICATIONS_HIDDEN_IDS_KEY)) as HiddenIdsByAddress | undefined
        const next: HiddenIdsByAddress = { ...(raw && typeof raw === 'object' ? raw : {}), [address]: [...ids] }
        await settingsAPI.set(NOTIFICATIONS_HIDDEN_IDS_KEY, next)
      } catch (e) {
        console.error('[notifications] saveHiddenIdsToSettings failed', e)
      }
    },

    /** Текущая высота сети (getnodeinfo). Если нет сохранённого блока — запрашиваем с неё (0 новых уведомлений). */
    async getCurrentBlockHeight(): Promise<number> {
      const data = await rpcCall<GetNodeInfoData>({ method: rpcEndpoints.getNodeInfo, parameters: [], options: { auth: false } })
      const h = data?.lastblock?.height
      if (typeof h === 'number' && h > 0) return h
      return 0
    },

    _isTimeoutError(err: unknown): boolean {
      if (!err || typeof err !== 'object') return false
      const o = err as Record<string, unknown>
      const code = o?.code ?? (o?.error && typeof o.error === 'object' && (o.error as Record<string, unknown>)?.code)
      const msg = String(o?.message ?? (o?.error && typeof o.error === 'object' && (o.error as Record<string, unknown>)?.message) ?? '')
      return code === 408 || code === 500 || /timeout/i.test(msg)
    },

    async init(opts?: { forceRefresh?: boolean }) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!auth.isUserAuthenticated || !address) return
      if (!opts?.forceRefresh && this.inited && this.initedForAddress === address) return

      this.initedForAddress = address
      this.inited = true
      this.loading = true

      const [savedBlock, storedList, hiddenIds] = await Promise.all([
        this.loadLastBlockFromSettings(address),
        notificationsAPI.getAllByAddress(address),
        this.loadHiddenIdsFromSettings(address)
      ])

      this.hiddenIds = hiddenIds
      if (savedBlock != null && savedBlock > 0) {
        this.lastBlock = savedBlock
      } else {
        try {
          this.lastBlock = await this.getCurrentBlockHeight() || 0
        } catch {
          this.lastBlock = 0
        }
      }

      // Преобразуем запись IDB в NotificationItem для state
      const toItem = (s: { id: string; nblock: number; type: string; title: string; description?: string; time: number; link?: string; from?: string; shareId?: string; mesType?: string; upvoteVal?: number }): NotificationItem => ({
        id: s.id,
        nblock: s.nblock,
        type: s.type as NotificationItem['type'],
        title: s.title,
        description: s.description,
        time: s.time,
        link: s.link,
        seen: false,
        from: s.from,
        shareId: s.shareId,
        mesType: s.mesType,
        upvoteVal: s.upvoteVal
      })
      this.items = storedList.map(toItem)

      const maxRetries = 2
      let lastError: unknown
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 2000))
        }
        try {
          const blockToRequest = this.lastBlock || 0
          const params: GetMissedInfoParameters = [address, blockToRequest, 30]
          // getmissedinfo всегда без кэша — актуальные пропущенные события
          const arr = await rpcCallArrayWithAuth<GetMissedInfoDataItem>({
            method: rpcEndpoints.getMissedInfo,
            parameters: params,
            options: { cache: false }
          })
          const blockInfo = arr[0]
          if (blockInfo && typeof blockInfo === 'object' && 'block' in blockInfo && 'contentsLang' in blockInfo) {
            this.lastBlock = Number((blockInfo as GetMissedInfoBlockItem).block) || this.lastBlock
          }
          const rawEvents = arr.slice(1) as (GetMissedInfoEventItem | Record<string, unknown>)[]
          const mapped = rawEvents
            .map((n) => mapMissedEventToNotification(n))
            .filter((n): n is NotificationItem => n != null)
          const existingIds = new Set(this.items.map((i) => i.id))
          const newItems = mapped.filter((n) => !existingIds.has(n.id))
          if (newItems.length > 0) {
            const toStore = newItems.map(({ id, nblock = 0, type, title, description, time, link, from, shareId, mesType, upvoteVal }) => ({
              id,
              nblock,
              type,
              title,
              description,
              time,
              link,
              from,
              shareId,
              mesType,
              upvoteVal
            }))
            await notificationsAPI.putMany(address, toStore)
            this.items = [...newItems, ...this.items]
          }
          if (opts?.forceRefresh && newItems.length > 0 && this.onNewNotifications) {
            try {
              this.onNewNotifications(newItems)
            } catch (e) {
              console.error('[notifications] onNewNotifications callback failed', e)
            }
          }
          lastError = undefined
          break
        } catch (e) {
          lastError = e
          const isRetryable = attempt < maxRetries && this._isTimeoutError(e)
          if (!isRetryable) {
            // Keep cached items/hiddenIds — don't wipe data on transient errors.
            // Only mark as not-inited so next call retries the fetch.
            console.warn('[notifications] Failed to fetch notifications', e)
            this.inited = false
            break
          }
        }
      }
      if (lastError !== undefined) {
        console.warn('[notifications] All retry attempts exhausted', lastError)
        this.inited = false
      }
      this.loading = false
    },
    setOnNewNotifications(cb: ((items: NotificationItem[]) => void) | null) {
      this.onNewNotifications = cb
    },
    reset() {
      this.items = []
      this.hiddenIds = new Set()
      this.inited = false
      this.initedForAddress = null
      this.lastBlock = 0
      this.onNewNotifications = null
      this.postCache = {}
      this.commentCache = {}
      this.profileCache = {}
      this.enrichedIds = new Set()
      this.enriching = false
    },
    setItems(items: NotificationItem[]) {
      this.items = items
    },
    add(item: NotificationItem) {
      if (this.items.some((n) => n.id === item.id)) return
      this.items = [item, ...this.items]
    },

    /**
     * При открытии выпадашки только двигаем указатель блока (прочитано до).
     * Уведомления не скрываются автоматически.
     */
    async persistReadPointer() {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (address && this.lastBlock > 0) {
        await this.saveLastBlockToSettings(address, this.lastBlock)
      }
    },

    /**
     * Скрыть одно уведомление (по кнопке «Скрыть уведомление» в меню).
     */
    async hideNotification(id: string) {
      this.hiddenIds = new Set([...this.hiddenIds, id])
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (address) await this.saveHiddenIdsToSettings(address, this.hiddenIds)
    },

    /**
     * Скрыть все уведомления (кнопка «Убрать все уведомления»).
     */
    async hideAllNotifications() {
      const ids = this.list.map((n) => n.id)
      this.hiddenIds = new Set([...this.hiddenIds, ...ids])
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (address) await this.saveHiddenIdsToSettings(address, this.hiddenIds)
    },

    /**
     * Догрузить недостающие данные для уведомлений (посты, комментарии, профили).
     * Батчит запросы и кэширует результаты в памяти.
     * Вызывать при открытии выпадашки для видимых items.
     */
    async enrichVisible(notifications: NotificationItem[]) {
      if (!notifications || notifications.length === 0) return

      const fresh = notifications.filter((n) => !this.enrichedIds.has(n.id))
      if (fresh.length === 0) return
      fresh.forEach((n) => this.enrichedIds.add(n.id))

      const postTxids = new Set<string>()
      const commentTxids = new Set<string>()
      const profileAddrs = new Set<string>()

      for (const n of fresh) {
        // Пост — нужен для типов с shareId; либо если comment имеет postid, чтобы открыть родительский пост
        const postId = n.shareId ?? n.commentSnapshot?.postid
        if (postId && !this.postCache[postId] && !(n.postSnapshot && n.postSnapshot.message)) {
          postTxids.add(postId)
        }
        // Комментарий — id уведомления для type=comment является txid комментария
        if (n.type === 'comment' && !n.commentSnapshot?.message && !this.commentCache[n.id]) {
          commentTxids.add(n.id)
        }
        // Профиль отправителя
        const addr = n.from ?? n.fromSnapshot?.address
        if (addr && !this.profileCache[addr]?.name && !n.fromSnapshot?.name) {
          profileAddrs.add(addr)
        }
      }

      const tasks: Array<Promise<unknown>> = []
      if (postTxids.size > 0) {
        const ids = [...postTxids]
        tasks.push(
          rpcCallWithAuth<unknown[]>({
            method: rpcEndpoints.getRawTransactionWithMessageById,
            parameters: [ids],
            cachehash: generateCacheHash(),
            options: {},
            state: 1
          })
            .then((arr) => {
              const list = Array.isArray(arr) ? arr : []
              for (const raw of list) {
                if (!raw || typeof raw !== 'object') continue
                const o = raw as Record<string, unknown>
                const txid = pickStr(o, 'txid', 'hash', 'id')
                if (!txid) continue
                this.postCache[txid] = {
                  ...(o as Record<string, unknown>),
                  txid,
                  caption: pickStr(o, 'c', 'caption', 'title'),
                  message: pickStr(o, 'm', 'message', 'text'),
                  type: pickStr(o, 'type'),
                  images: pickArr<string>(o, 'i', 'images')
                }
              }
            })
            .catch((e) => {
              console.warn('[notifications] enrich posts failed', e)
            })
        )
      }
      if (commentTxids.size > 0) {
        // Комментарии — это тоже tx, поэтому грузим тем же RPC
        const ids = [...commentTxids]
        tasks.push(
          rpcCallWithAuth<unknown[]>({
            method: rpcEndpoints.getRawTransactionWithMessageById,
            parameters: [ids],
            cachehash: generateCacheHash(),
            options: {},
            state: 1
          })
            .then((arr) => {
              const list = Array.isArray(arr) ? arr : []
              for (const raw of list) {
                const snap = extractCommentSnapshot(raw)
                if (snap) this.commentCache[snap.id] = snap
              }
            })
            .catch((e) => {
              console.warn('[notifications] enrich comments failed', e)
            })
        )
      }
      if (profileAddrs.size > 0) {
        const addrs = [...profileAddrs]
        tasks.push(
          rpcCall<UserProfile[]>({
            method: rpcEndpoints.getUserProfile,
            parameters: [addrs],
            options: { auth: false }
          })
            .then((arr) => {
              const list = Array.isArray(arr) ? arr : []
              for (const p of list) {
                if (!p || !p.address) continue
                this.profileCache[p.address] = {
                  address: p.address,
                  name: p.name,
                  avatar: typeof p.i === 'string' ? p.i : undefined,
                  reputation: typeof p.reputation === 'number' ? p.reputation : undefined,
                  profile: p
                }
              }
            })
            .catch((e) => {
              console.warn('[notifications] enrich profiles failed', e)
            })
        )
      }

      if (tasks.length === 0) return
      this.enriching = true
      try {
        await Promise.all(tasks)
      } finally {
        this.enriching = false
      }
    },

    /**
     * Превью данных для конкретного уведомления — берёт из snapshot или кэша.
     * Используется компонентом для отрисовки богатой карточки.
     */
    getEnrichment(item: NotificationItem) {
      const postId = item.shareId ?? item.commentSnapshot?.postid
      const post = item.postSnapshot ?? (postId ? this.postCache[postId] : undefined)
      const comment = item.commentSnapshot ?? this.commentCache[item.id]
      const fromAddr = item.from ?? item.fromSnapshot?.address
      const fromCached = fromAddr ? this.profileCache[fromAddr] : undefined
      const from = item.fromSnapshot ?? fromCached
      return { post, comment, from }
    }
  }
})
