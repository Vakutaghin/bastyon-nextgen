import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores'
import { getByPRCWithAuth, getByPRC } from '@/helpers/api/request'
import { settingsAPI } from '@/db'
import type { GetMissedInfoParameters } from '@/types/rpc-requests/get-missed-info'
import type { GetMissedInfoBlockItem, GetMissedInfoEventItem } from '@/types/rpc-responses/get-missed-info'

const NOTIFICATIONS_LAST_BLOCK_KEY = 'notificationsLastBlock'

/** В IDB храним { [address]: block } */
type LastBlockByAddress = Record<string, number>

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

function mapMissedEventToNotification(n: GetMissedInfoEventItem | Record<string, unknown>): NotificationItem | null {
  const id = (n.txid ?? n.id ?? n.nblock ?? Math.random().toString(36)) as string
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
  return {
    id: String(id),
    type: safeType,
    title: String(title),
    description,
    time,
    link,
    seen: false,
    from: (n.addrFrom ?? (n.account as Record<string, unknown>)?.name) as string | undefined,
    shareId: (n.posttxid ?? n.rootTxHash ?? n.postHash) as string | undefined
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

export interface NotificationItem {
  id: string
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
}

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as NotificationItem[],
    loading: false,
    inited: false,
    lastBlock: 0 as number,
    /** Адрес, для которого загружали — при смене пользователя сбрасываем inited */
    initedForAddress: null as string | null
  }),
  getters: {
    list(): NotificationItem[] {
      return [...this.items].sort((a, b) => b.time - a.time)
    },
    unreadCount(): number {
      return this.items.filter((n) => !n.seen).length
    },
    unreadList(): NotificationItem[] {
      return this.list.filter((n) => !n.seen)
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

    /** Сохранить высоту блока в IDB для адреса (все уведомления до этого блока прочитаны). */
    async saveLastBlockToSettings(address: string, block: number): Promise<void> {
      try {
        const raw = (await settingsAPI.get(NOTIFICATIONS_LAST_BLOCK_KEY)) as LastBlockByAddress | undefined
        const next: LastBlockByAddress = { ...(raw && typeof raw === 'object' ? raw : {}), [address]: block }
        await settingsAPI.set(NOTIFICATIONS_LAST_BLOCK_KEY, next)
      } catch (e) {
        console.error('[notifications] saveLastBlockToSettings failed', e)
      }
    },

    /** Текущая высота сети (getnodeinfo). Если нет сохранённого блока — запрашиваем с неё (0 новых уведомлений). */
    async getCurrentBlockHeight(): Promise<number> {
      const res = await getByPRC({ method: 'getnodeinfo', parameters: [], options: { auth: false } }) as unknown
      const data = (res && typeof res === 'object' && 'data' in res) ? (res as { data: unknown }).data : res
      const obj = typeof data === 'object' && data !== null ? data as Record<string, unknown> : null
      const lastblock = obj?.lastblock as { height?: number } | undefined
      const h = lastblock?.height
      if (typeof h === 'number' && h > 0) return h
      return 0
    },

    /** Извлекает массив из ответа прокси (data/result) или сырой массив */
    _unwrapResponse(raw: unknown): unknown[] {
      if (Array.isArray(raw)) return raw
      if (!raw || typeof raw !== 'object') return []
      const obj = raw as Record<string, unknown>
      if (Array.isArray(obj.data)) return obj.data
      if (Array.isArray(obj.result)) return obj.result
      // вложенная обёртка, например { data: { data: [...] } }
      if (obj.data && typeof obj.data === 'object' && Array.isArray((obj.data as Record<string, unknown>).data)) {
        return (obj.data as Record<string, unknown>).data as unknown[]
      }
      return []
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

      const savedBlock = await this.loadLastBlockFromSettings(address)
      if (savedBlock != null && savedBlock > 0) {
        this.lastBlock = savedBlock
      } else {
        try {
          this.lastBlock = await this.getCurrentBlockHeight() || 0
        } catch {
          this.lastBlock = 0
        }
      }

      const maxRetries = 2
      let lastError: unknown
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 2000))
        }
        try {
          const blockToRequest = this.lastBlock || 0
          const params: GetMissedInfoParameters = [address, blockToRequest, 30]
          const raw = await getByPRCWithAuth({
            method: 'getmissedinfo',
            parameters: params,
            options: { cache: false }
          }) as unknown
          const arr = this._unwrapResponse(raw)
          const blockInfo = arr[0]
          if (blockInfo && typeof blockInfo === 'object' && 'block' in blockInfo && 'contentsLang' in blockInfo) {
            this.lastBlock = Number((blockInfo as GetMissedInfoBlockItem).block) || this.lastBlock
          }
          const rawEvents = arr.slice(1) as (GetMissedInfoEventItem | Record<string, unknown>)[]
          const mapped = rawEvents
            .map((n) => mapMissedEventToNotification(n))
            .filter((n): n is NotificationItem => n != null)
          this.items = mapped
          lastError = undefined
          break
        } catch (e) {
          lastError = e
          const isRetryable = attempt < maxRetries && this._isTimeoutError(e)
          if (!isRetryable) {
            this.items = []
            this.initedForAddress = null
            this.inited = false
            break
          }
        }
      }
      if (lastError !== undefined) {
        this.items = []
        this.initedForAddress = null
        this.inited = false
      }
      this.loading = false
    },
    reset() {
      this.items = []
      this.inited = false
      this.initedForAddress = null
      this.lastBlock = 0
    },
    setItems(items: NotificationItem[]) {
      this.items = items
    },
    add(item: NotificationItem) {
      if (this.items.some((n) => n.id === item.id)) return
      this.items = [item, ...this.items]
    },
    markSeen(id: string) {
      const n = this.items.find((i) => i.id === id)
      if (n) n.seen = true
    },
    markAllSeen() {
      this.items.forEach((n) => (n.seen = true))
    },

    /**
     * Пометить все уведомления прочитанными и сохранить высоту блока в IDB.
     * Вызывать при открытии выпадающего списка уведомлений.
     */
    async markAllSeenAndPersistBlock() {
      this.markAllSeen()
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (address && this.lastBlock > 0) {
        await this.saveLastBlockToSettings(address, this.lastBlock)
      }
    }
  }
})
