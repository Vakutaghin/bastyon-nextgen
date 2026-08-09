import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores'
import { notificationsAPI } from '@/db/apis/notifications-api'
import type { GetMissedInfoBlockItem } from '@/types/rpc-responses/get-missed-info'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import type {
  NotificationItem,
  NotificationPostSnapshot,
  NotificationCommentSnapshot,
  NotificationUserSnapshot,
} from './notifications-types'
import { mapMissedEventToNotification } from './notifications-mappers'
import { enrichNotifications } from './notifications-enricher'
import {
  loadLastBlockFromSettings,
  saveLastBlockToSettings,
  loadHiddenIdsFromSettings,
  saveHiddenIdsToSettings,
} from './notifications-settings'
import { fetchCurrentBlockHeight, isTimeoutError, fetchMissedInfo } from './notifications-fetch'

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
    /** Курсор фетча getmissedinfo (двигается на head сети при каждом опросе). */
    lastBlock: 0 as number,
    /**
     * Read-pointer: до какого блока пользователь реально видел уведомления.
     * Отдельно от lastBlock (P2-8) — двигается ТОЛЬКО по явному прочтению
     * (persistReadPointer при открытии выпадашки), иначе новые уведомления
     * мгновенно становились бы «seen» из-за скачка курсора фетча на head.
     */
    readBlock: 0 as number,
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
    async init(opts?: { forceRefresh?: boolean }) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!auth.isUserAuthenticated || !address) return
      if (!opts?.forceRefresh && this.inited && this.initedForAddress === address) return

      this.initedForAddress = address
      this.inited = true
      this.loading = true

      const [savedBlock, storedList, hiddenIds] = await Promise.all([
        loadLastBlockFromSettings(address),
        notificationsAPI.getAllByAddress(address),
        loadHiddenIdsFromSettings(address),
      ])

      this.hiddenIds = hiddenIds
      if (savedBlock != null && savedBlock > 0) {
        this.lastBlock = savedBlock
      } else {
        try {
          this.lastBlock = (await fetchCurrentBlockHeight()) || 0
        } catch {
          this.lastBlock = 0
        }
      }
      // Стартовый read-pointer = сохранённая позиция прочтения (P2-8). Курсор
      // фетча (lastBlock) дальше уедет на head, а readBlock останется здесь,
      // пока пользователь явно не откроет выпадашку (persistReadPointer).
      this.readBlock = this.lastBlock

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
          const arr = await fetchMissedInfo(address, blockToRequest)
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
          const isRetryable = attempt < maxRetries && isTimeoutError(e)
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
      this.readBlock = 0
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
      // Явное прочтение: двигаем read-pointer на текущий курсор фетча (P2-8)
      // и персистим именно read-pointer.
      this.readBlock = this.lastBlock
      if (address && this.readBlock > 0) {
        await saveLastBlockToSettings(address, this.readBlock)
      }
    },

    /**
     * Скрыть одно уведомление (по кнопке «Скрыть уведомление» в меню).
     */
    async hideNotification(id: string) {
      this.hiddenIds = new Set([...this.hiddenIds, id])
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (address) await saveHiddenIdsToSettings(address, this.hiddenIds)
    },

    /**
     * Скрыть все уведомления (кнопка «Убрать все уведомления»).
     */
    async hideAllNotifications() {
      const ids = this.list.map((n) => n.id)
      this.hiddenIds = new Set([...this.hiddenIds, ...ids])
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (address) await saveHiddenIdsToSettings(address, this.hiddenIds)
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
