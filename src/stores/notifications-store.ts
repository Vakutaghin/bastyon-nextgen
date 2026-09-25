import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores'
import { notificationsAPI } from '@/db/apis/notifications-api'
import type {
  GetMissedInfoBlockItem,
  GetMissedInfoEventItem,
} from '@/types/rpc-responses/get-missed-info'
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
  loadFetchBlockFromSettings,
  saveFetchBlockToSettings,
  loadHiddenIdsFromSettings,
  saveHiddenIdsToSettings,
} from './notifications-settings'
import { NOTIFICATIONS_KEEP_LIMIT } from './notifications-constants'
import { isNotificationAllowed } from './notification-filtering'
import { useNotificationSettingsStore } from './notification-settings-store'
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
    /** Идёт init (boot/поллер/смена аккаунта) — второй параллельный не запускаем. */
    initInFlight: false,
    /** Номер запуска init: ответ старого запуска после reset/смены аккаунта игнорируется. */
    initSeq: 0,
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
    /**
     * Список без скрытых и без запрещённых настройками, по убыванию nblock/time.
     * Фильтры раньше действовали только на тосты, а список показывал всё (S56).
     */
    list(): NotificationItem[] {
      const filters = useNotificationSettingsStore()
      const filtered = this.items.filter(
        (n) => !this.hiddenIds.has(n.id) && isNotificationAllowed(filters, n)
      )
      return [...filtered].sort((a, b) => (b.nblock ?? b.time) - (a.nblock ?? a.time))
    },
    /**
     * Бейдж — именно НЕПРОЧИТАННЫЕ: те, что новее read-pointer. Раньше считались
     * все нескрытые за всё время, и цифра не обнулялась никогда (S53).
     */
    unreadCount(): number {
      return this.unreadList.length
    },
    unreadList(): NotificationItem[] {
      const read = this.readBlock
      return this.list.filter((n) => (n.nblock ?? 0) > read)
    },
  },
  actions: {
    async init(opts?: { forceRefresh?: boolean }) {
      const auth = useAuthStore()
      const address = auth.getUserAddress
      if (!auth.isUserAuthenticated || !address) return
      if (!opts?.forceRefresh && this.inited && this.initedForAddress === address) return
      // In-flight guard: параллельный init (boot + поллер) дописывал бы items дважды.
      if (this.initInFlight) return

      const run = ++this.initSeq
      // Ответ, пришедший после смены аккаунта или более позднего init — чужой:
      // уведомления и тосты A иначе показывались пользователю B (S14).
      const stale = () => run !== this.initSeq || useAuthStore().getUserAddress !== address

      this.initInFlight = true
      this.initedForAddress = address
      this.inited = true
      this.loading = true
      try {
        await this.initFor(address, stale, opts)
      } catch (e) {
        // Исключение из IDB/сети раньше оставляло loading=true навсегда.
        console.warn('[notifications] init failed', e)
        if (!stale()) this.inited = false
      } finally {
        if (run === this.initSeq) {
          this.initInFlight = false
          this.loading = false
        }
      }
    },

    async initFor(address: string, stale: () => boolean, opts?: { forceRefresh?: boolean }) {
      const [savedReadBlock, savedFetchBlock, storedList, hiddenIds] = await Promise.all([
        loadLastBlockFromSettings(address),
        loadFetchBlockFromSettings(address),
        notificationsAPI.getAllByAddress(address),
        loadHiddenIdsFromSettings(address),
      ])
      if (stale()) return

      this.hiddenIds = hiddenIds
      // Курсор фетча: свой персист (V38). Пока его нет — берём позицию
      // прочтения, а если и её нет (первый запуск) — голову сети.
      const startBlock = savedFetchBlock ?? savedReadBlock
      if (startBlock != null && startBlock > 0) {
        this.lastBlock = startBlock
      } else {
        try {
          const height = (await fetchCurrentBlockHeight()) || 0
          if (stale()) return
          this.lastBlock = height
        } catch {
          if (stale()) return
          this.lastBlock = 0
        }
      }
      // Read-pointer (P2-8) двигается ТОЛЬКО по явному просмотру выпадашки;
      // курсор фетча уедет на head, а этот останется здесь.
      this.readBlock = savedReadBlock ?? this.lastBlock

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
      // Полный пересбор из IDB терял снапшоты (их там нет) и вместе с
      // `enrichedIds` оставлял карточки без имени актора и текста коммента до
      // перезагрузки (V39). Поэтому уже имеющиеся в памяти записи сохраняем.
      const inMemory = new Map(this.items.map((n) => [n.id, n]))
      this.items = storedList.map((s) => inMemory.get(s.id) ?? toItem(s))

      const maxRetries = 2
      let lastError: unknown
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 2000))
        }
        try {
          const blockToRequest = this.lastBlock || 0
          const arr = await fetchMissedInfo(address, blockToRequest)
          if (stale()) return
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
            // Снимки из события живут только в памяти (в IDB их нет) — кладём
            // их в кэши обогащения, чтобы пережить пересбор списка (V39).
            this.cacheSnapshots(newItems)
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
            if (stale()) return
            this.items = [...newItems, ...this.items]
          }
          // Курсор фетча персистится при КАЖДОМ опросе, иначе следующий запуск
          // снова начал бы с головы сети (V38).
          if (this.lastBlock > 0) {
            void saveFetchBlockToSettings(address, this.lastBlock)
          }
          if (newItems.length > 0) {
            void this.pruneStored(address)
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
    },
    /** Кладёт снимки события в кэши обогащения (переживают пересбор списка). */
    cacheSnapshots(items: NotificationItem[]) {
      for (const n of items) {
        const postId = n.shareId ?? n.commentSnapshot?.postid
        if (n.postSnapshot && postId) {
          this.postCache[postId] = { ...this.postCache[postId], ...n.postSnapshot }
        }
        if (n.commentSnapshot) {
          this.commentCache[n.id] = { ...this.commentCache[n.id], ...n.commentSnapshot }
        }
        const fromAddr = n.from ?? n.fromSnapshot?.address
        if (n.fromSnapshot && fromAddr) {
          this.profileCache[fromAddr] = { ...this.profileCache[fromAddr], ...n.fromSnapshot }
        }
      }
    },

    /**
     * Обрезает хранилище до NOTIFICATIONS_KEEP_LIMIT последних записей и
     * выбрасывает скрытые id, которых уже нет в базе: иначе и то и другое
     * росло вечно, а каждый опрос читал тысячи записей (S53).
     */
    async pruneStored(address: string) {
      try {
        const stored = await notificationsAPI.getAllByAddress(address)
        if (stored.length > NOTIFICATIONS_KEEP_LIMIT) {
          const extra = stored.slice(NOTIFICATIONS_KEEP_LIMIT)
          await notificationsAPI.deleteMany(
            address,
            extra.map((s) => s.id)
          )
        }
        const keep = new Set(stored.slice(0, NOTIFICATIONS_KEEP_LIMIT).map((s) => s.id))
        const hidden = [...this.hiddenIds].filter((id) => keep.has(id))
        if (hidden.length !== this.hiddenIds.size) {
          this.hiddenIds = new Set(hidden)
          await saveHiddenIdsToSettings(address, this.hiddenIds)
        }
      } catch (e) {
        console.warn('[notifications] prune failed', e)
      }
    },

    setOnNewNotifications(cb: ((items: NotificationItem[]) => void) | null) {
      this.onNewNotifications = cb
    },
    /**
     * Сброс при смене/выходе аккаунта (X9). Колбэк тостов не трогаем — его
     * ставит main.ts один раз на всё приложение; после выхода и нового входа
     * тосты иначе переставали приходить.
     */
    reset() {
      this.initSeq++ // обесценивает ответы init, которые ещё в полёте
      this.initInFlight = false
      this.loading = false
      this.items = []
      this.hiddenIds = new Set()
      this.inited = false
      this.initedForAddress = null
      this.lastBlock = 0
      this.readBlock = 0
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
