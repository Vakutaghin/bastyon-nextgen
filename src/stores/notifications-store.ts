import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCall, rpcCallArrayWithAuth } from '@/helpers/api/request'
import { settingsAPI } from '@/db/apis/settings-api'
import { notificationsAPI } from '@/db/apis/notifications-api'
import type { GetMissedInfoParameters } from '@/types/rpc-requests/get-missed-info'
import type {
  GetMissedInfoBlockItem,
  GetMissedInfoDataItem,
} from '@/types/rpc-responses/get-missed-info'
import type { GetNodeInfoData } from '@/types/rpc-responses/get-node-info'
import type { UserProfile } from '@/types/rpc-responses/user-get'

import {
  NOTIFICATIONS_LAST_BLOCK_KEY,
  NOTIFICATIONS_HIDDEN_IDS_KEY,
} from './notifications-constants'
import type {
  NotificationItem,
  NotificationPostSnapshot,
  NotificationCommentSnapshot,
  NotificationUserSnapshot,
  LastBlockByAddress,
  HiddenIdsByAddress,
} from './notifications-types'
import { mapMissedEventToNotification } from './notifications-mappers'
import { enrichNotifications } from './notifications-enricher'

// Реэкспорт типов: внешние модули продолжают импортировать из @/stores/notifications-store.
export type {
  NotificationItem,
  NotificationType,
  NotificationPostSnapshot,
  NotificationCommentSnapshot,
  NotificationUserSnapshot,
} from './notifications-types'

/**
 * Запрос уведомлений: getmissedinfo(address, block, limit).
 * Ответ data: [BlockItem, ...EventItem[]]; события маппятся в NotificationItem.
 * Блок для следующего запроса сохраняем в IDB при открытии выпадашки (все прочитаны).
 */

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
    enrichedIds: new Set<string>() as Set<string>,
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
    },
  },
  actions: {
    /** Высота блока из IDB для адреса (с какого блока запрашивать уведомления). */
    async loadLastBlockFromSettings(address: string): Promise<number | null> {
      try {
        const raw = (await settingsAPI.get(NOTIFICATIONS_LAST_BLOCK_KEY)) as
          | LastBlockByAddress
          | undefined
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
        const raw = (await settingsAPI.get(NOTIFICATIONS_LAST_BLOCK_KEY)) as
          | LastBlockByAddress
          | undefined
        const next: LastBlockByAddress = {
          ...(raw && typeof raw === 'object' ? raw : {}),
          [address]: block,
        }
        await settingsAPI.set(NOTIFICATIONS_LAST_BLOCK_KEY, next)
      } catch (e) {
        console.error('[notifications] saveLastBlockToSettings failed', e)
      }
    },

    /** Загрузить скрытые id для адреса из settings. */
    async loadHiddenIdsFromSettings(address: string): Promise<Set<string>> {
      try {
        const raw = (await settingsAPI.get(NOTIFICATIONS_HIDDEN_IDS_KEY)) as
          | HiddenIdsByAddress
          | undefined
        const arr =
          raw && typeof raw === 'object' && Array.isArray(raw[address]) ? raw[address] : []
        return new Set(arr)
      } catch {
        return new Set()
      }
    },

    /** Сохранить скрытые id для адреса в settings. */
    async saveHiddenIdsToSettings(address: string, ids: Set<string>): Promise<void> {
      try {
        const raw = (await settingsAPI.get(NOTIFICATIONS_HIDDEN_IDS_KEY)) as
          | HiddenIdsByAddress
          | undefined
        const next: HiddenIdsByAddress = {
          ...(raw && typeof raw === 'object' ? raw : {}),
          [address]: [...ids],
        }
        await settingsAPI.set(NOTIFICATIONS_HIDDEN_IDS_KEY, next)
      } catch (e) {
        console.error('[notifications] saveHiddenIdsToSettings failed', e)
      }
    },

    /** Текущая высота сети (getnodeinfo). Если нет сохранённого блока — запрашиваем с неё (0 новых уведомлений). */
    async getCurrentBlockHeight(): Promise<number> {
      const data = await rpcCall<GetNodeInfoData>({
        method: rpcEndpoints.getNodeInfo,
        parameters: [],
        options: { auth: false },
      })
      const h = data?.lastblock?.height
      if (typeof h === 'number' && h > 0) return h
      return 0
    },

    _isTimeoutError(err: unknown): boolean {
      if (!err || typeof err !== 'object') return false
      const o = err as Record<string, unknown>
      const code =
        o?.code ??
        (o?.error && typeof o.error === 'object' && (o.error as Record<string, unknown>)?.code)
      const msg = String(
        o?.message ??
          (o?.error &&
            typeof o.error === 'object' &&
            (o.error as Record<string, unknown>)?.message) ??
          ''
      )
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
        this.loadHiddenIdsFromSettings(address),
      ])

      this.hiddenIds = hiddenIds
      if (savedBlock != null && savedBlock > 0) {
        this.lastBlock = savedBlock
      } else {
        try {
          this.lastBlock = (await this.getCurrentBlockHeight()) || 0
        } catch {
          this.lastBlock = 0
        }
      }

      // Преобразуем запись IDB в NotificationItem для state
      const toItem = (s: {
        id: string
        nblock: number
        type: string
        title: string
        description?: string
        time: number
        link?: string
        from?: string
        shareId?: string
        mesType?: string
        upvoteVal?: number
      }): NotificationItem => ({
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
        upvoteVal: s.upvoteVal,
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
            options: { cache: false },
          })
          const blockInfo = arr[0]
          if (
            blockInfo &&
            typeof blockInfo === 'object' &&
            'block' in blockInfo &&
            'contentsLang' in blockInfo
          ) {
            this.lastBlock = Number((blockInfo as GetMissedInfoBlockItem).block) || this.lastBlock
          }
          const rawEvents = arr.slice(1) as (GetMissedInfoEventItem | Record<string, unknown>)[]
          const mapped = rawEvents
            .map((n) => mapMissedEventToNotification(n))
            .filter((n): n is NotificationItem => n != null)
          const existingIds = new Set(this.items.map((i) => i.id))
          const newItems = mapped.filter((n) => !existingIds.has(n.id))
          if (newItems.length > 0) {
            const toStore = newItems.map(
              ({
                id,
                nblock = 0,
                type,
                title,
                description,
                time,
                link,
                from,
                shareId,
                mesType,
                upvoteVal,
              }) => ({
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
                upvoteVal,
              })
            )
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
     * Делегирует в notifications-enricher; здесь — только пробрасывание state.
     */
    async enrichVisible(notifications: NotificationItem[]) {
      await enrichNotifications(
        {
          postCache: this.postCache,
          commentCache: this.commentCache,
          profileCache: this.profileCache,
          enrichedIds: this.enrichedIds,
        },
        notifications,
        (v) => {
          this.enriching = v
        }
      )
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
    },
  },
})
