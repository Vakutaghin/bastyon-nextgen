/**
 * Отношения текущего пользователя с другими: блок-лист и подписки (follow).
 *
 * Источник истины — блокчейн:
 *   - блок-лист приходит в `getuserprofile(myAddress).blocking` (string[]);
 *   - подписки — отдельным `getusersubscribes(myAddress)` (legacy psdk.subscribes.load).
 * Стор гидрируется из ноды при init() и оптимистично обновляется при
 * block()/unblock() и subscribe()/subscribePrivate()/unsubscribe(), которые шлют
 * on-chain транзакции (см. core/actions/user-relations-action).
 *
 * Ограничение: изменения, сделанные на другом устройстве/в legacy-клиенте,
 * подхватятся только после refresh()/refreshSubscriptions(). В рамках текущей
 * сессии состояние консистентно.
 *
 * Пока транзакция по адресу не в блоке, повторное нажатие не шлёт вторую (нода
 * её отклонит), а встаёт в очередь и уходит после блока — см. deferred-relation.
 */

import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCall } from '@/helpers/api/request'
import {
  blockUser as blockUserTx,
  unblockUser as unblockUserTx,
  subscribeUser as subscribeUserTx,
  subscribeUserPrivate as subscribeUserPrivateTx,
  unsubscribeUser as unsubscribeUserTx,
} from '@/blockchain/core/actions/user-relations-action'
import type { UserProfile, UserSubscribe } from '@/types/rpc-responses/user-get'
import { onTransactionSettled } from '@/blockchain/core/transactions/broadcast-events'
import { usePendingTransactionsStore } from '@/stores/pending-transactions-store'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'
import { DeferredRelation } from './deferred-relation'

/** Подписка на человека: публичная, приватная (с уведомлениями) или нет. */
export type SubscriptionState = 'public' | 'private' | 'none'

/** Выборы, ждущие блока, — переживают перезапуск (по аккаунтам). */
const QUEUE_STORAGE_PREFIX = 'BST_RELATION_QUEUE_'

interface StoredQueue {
  subscriptions?: Array<[string, SubscriptionState]>
  blocks?: Array<[string, boolean]>
}

/** Сырой элемент ответа getusersubscribes (терпим к опечатке adddress/address). */
type RawSubscribe = UserSubscribe & { address?: string }

/** Считает подписку приватной (legacy private: "true" | true | 1). */
function isPrivateSub(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

/**
 * Синхронизирует matrix-ignore с on-chain блокировкой (решение Р3, S43).
 * Импорт динамический: сторы отношений не должны тянуть мессенджер в бандл,
 * а без запущенного matrix-клиента вызов просто ничего не делает.
 */
async function applyMatrixIgnore(address: string, ignored: boolean): Promise<void> {
  try {
    const { matrixService } = await import('@/b-components/messenger/services/matrix-service')
    if (!matrixService.getClient()) return
    await matrixService.setIgnoredByAddress(address, ignored)
  } catch (e) {
    console.warn('[userRelations] matrix ignore sync failed', e)
  }
}

/** Поля и действия стора, нужные очередям (тип стора внутри defineStore ещё не известен). */
interface RelationsState {
  blocked: Set<string>
  pending: Set<string>
  subscribed: Set<string>
  subscribedPrivate: Set<string>
  subscribePending: Set<string>
  refresh(): Promise<void>
  refreshSubscriptions(): Promise<void>
}

interface RelationChannels {
  subscriptions: DeferredRelation<SubscriptionState>
  blocks: DeferredRelation<boolean>
  /** Отписка от событий блока. */
  stop: () => void
}

/** Неподтверждённая транзакция отношений по адресу — из «песочных часов». */
function findUnconfirmed(address: string, kinds: readonly string[]) {
  try {
    return (
      usePendingTransactionsStore().items.find(
        (i) => i.address === address && kinds.includes(i.kind)
      ) ?? null
    )
  } catch {
    return null
  }
}

/** Отложенная транзакция не ушла: человек нажал минуту назад, скажем, о чём речь. */
function deferredError(e: unknown): void {
  const reason = e instanceof Error && e.message ? e.message : t('subscriptions.errFailed')
  appToast.error({ message: t('subscriptions.errDeferred', { reason }) })
}

const channelsByStore = new WeakMap<object, RelationChannels>()

/** Идущая загрузка init(): второй вызов ждёт её, а не получает «готово» до ответа ноды. */
const initByStore = new WeakMap<object, Promise<void>>()

function createChannels(store: RelationsState): RelationChannels {
  const persistQueue = (): void => {
    const me = useAuthStore().getUserAddress
    if (!me) return
    const data: StoredQueue = {
      subscriptions: subscriptions.queueEntries(),
      blocks: blocks.queueEntries(),
    }
    try {
      if (data.subscriptions?.length || data.blocks?.length) {
        localStorage.setItem(QUEUE_STORAGE_PREFIX + me, JSON.stringify(data))
      } else {
        localStorage.removeItem(QUEUE_STORAGE_PREFIX + me)
      }
    } catch {
      // Хранилище недоступно — очередь живёт до перезапуска.
    }
  }

  const subscriptions = new DeferredRelation<SubscriptionState>({
    shown: (a) =>
      store.subscribed.has(a) ? (store.subscribedPrivate.has(a) ? 'private' : 'public') : 'none',
    show: (a, state) => {
      if (state === 'none') store.subscribed.delete(a)
      else store.subscribed.add(a)
      if (state === 'private') store.subscribedPrivate.add(a)
      else store.subscribedPrivate.delete(a)
    },
    send: (a, state) =>
      state === 'none'
        ? unsubscribeUserTx(a)
        : state === 'private'
          ? subscribeUserPrivateTx(a)
          : subscribeUserTx(a),
    setSending: (a, on) => (on ? store.subscribePending.add(a) : store.subscribePending.delete(a)),
    findUnconfirmed: (a) => {
      const tx = findUnconfirmed(a, ['subscribe', 'unsubscribe'])
      if (!tx) return null
      // Приватную от публичной ожидание не отличает — для очереди это неважно.
      return { txid: tx.txid, state: tx.kind === 'unsubscribe' ? 'none' : 'public' }
    },
    onDeferredError: deferredError,
    onQueueChange: persistQueue,
  })

  const blocks = new DeferredRelation<boolean>({
    shown: (a) => store.blocked.has(a),
    show: (a, on) => (on ? store.blocked.add(a) : store.blocked.delete(a)),
    send: (a, on) => (on ? blockUserTx(a) : unblockUserTx(a)),
    setSending: (a, on) => (on ? store.pending.add(a) : store.pending.delete(a)),
    findUnconfirmed: (a) => {
      const tx = findUnconfirmed(a, ['block', 'unblock'])
      return tx ? { txid: tx.txid, state: tx.kind === 'block' } : null
    },
    // Решение Р3: блокировка в социальном графе глушит и чат (S43).
    afterSent: (a, on) => void applyMatrixIgnore(a, on),
    onDeferredError: deferredError,
    onQueueChange: persistQueue,
  })

  const stop = onTransactionSettled((txid, confirmed) => {
    // Не попала в блок — что в цепочке, неизвестно: перечитать и свериться.
    if (subscriptions.settle(txid, confirmed)) void store.refreshSubscriptions()
    if (blocks.settle(txid, confirmed)) void store.refresh()
  })

  return { subscriptions, blocks, stop }
}

function channelsOf(store: RelationsState): RelationChannels {
  let channels = channelsByStore.get(store)
  if (!channels) {
    channels = createChannels(store)
    channelsByStore.set(store, channels)
  }
  return channels
}

/** Очередь с прошлого запуска для текущего аккаунта. */
function restoreQueue(channels: RelationChannels): void {
  const me = useAuthStore().getUserAddress
  if (!me) return
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_PREFIX + me)
    const data = raw ? (JSON.parse(raw) as StoredQueue) : null
    if (Array.isArray(data?.subscriptions)) channels.subscriptions.restoreQueue(data.subscriptions)
    if (Array.isArray(data?.blocks)) channels.blocks.restoreQueue(data.blocks)
  } catch {
    // Испорченная запись — начнём с пустой очереди.
  }
}

export const useUserRelationsStore = defineStore('userRelations', {
  state: () => ({
    /** Адреса, заблокированные текущим пользователем. */
    blocked: new Set<string>(),
    /** Адреса с in-flight block/unblock транзакцией (для дизейбла кнопок). */
    pending: new Set<string>(),
    /** Адреса, которые заблокировали МЕНЯ (legacy checkBanned, #34). */
    bannedBy: new Set<string>(),
    /** Адреса, чей блок-лист уже проверен (чтобы не дёргать getuserprofile повторно). */
    checkedAuthors: new Set<string>(),
    /** Адреса, на которые подписан текущий пользователь (public + private). */
    subscribed: new Set<string>(),
    /** Подмножество subscribed с приватной (нотификационной) подпиской. */
    subscribedPrivate: new Set<string>(),
    /** Адреса с in-flight subscribe/unsubscribe транзакцией. */
    subscribePending: new Set<string>(),
    /**
     * Список подписок пришёл с ноды. До этого «не подписан» ничего не значит:
     * кнопка «Подписаться» показывалась бы и подписанным.
     */
    subscriptionsLoaded: false,
    isInitialized: false,
    isLoading: false,
  }),

  getters: {
    /** Заблокирован ли адрес текущим пользователем. */
    isBlocked(): (address: string) => boolean {
      return (address: string) => this.blocked.has(address)
    },
    /** Идёт ли по адресу block/unblock транзакция. */
    isPending(): (address: string) => boolean {
      return (address: string) => this.pending.has(address)
    },
    /** Множество заблокированных адресов (для isBlockedByMe в visibility). */
    blockedSet(): ReadonlySet<string> {
      return this.blocked
    },
    /** Заблокировал ли указанный автор текущего пользователя (#34). */
    isBannedBy(): (address: string) => boolean {
      return (address: string) => this.bannedBy.has(address)
    },
    /** Подписан ли текущий пользователь на адрес (public или private). */
    isSubscribed(): (address: string) => boolean {
      return (address: string) => this.subscribed.has(address)
    },
    /** Является ли подписка на адрес приватной (с уведомлениями). */
    isSubscribedPrivate(): (address: string) => boolean {
      return (address: string) => this.subscribedPrivate.has(address)
    },
    /** Идёт ли по адресу subscribe/unsubscribe транзакция. */
    isSubscribePending(): (address: string) => boolean {
      return (address: string) => this.subscribePending.has(address)
    },
  },

  actions: {
    /** Загружает блок-лист и подписки из ноды один раз за сессию. */
    init(): Promise<void> {
      if (this.isInitialized) return initByStore.get(this) ?? Promise.resolve()
      this.isInitialized = true
      restoreQueue(channelsOf(this))
      const loading = Promise.all([this.refresh(), this.refreshSubscriptions()]).then(() => {})
      initByStore.set(this, loading)
      return loading
    },

    /** Перечитывает блок-лист текущего пользователя из getuserprofile. */
    async refresh(): Promise<void> {
      const address = useAuthStore().getUserAddress
      if (!address) return
      this.isLoading = true
      try {
        const arr = await rpcCall<UserProfile[]>({
          method: rpcEndpoints.getUserProfile,
          parameters: [[address]],
          options: { auth: false },
        })
        const me = Array.isArray(arr) ? (arr.find((p) => p?.address === address) ?? arr[0]) : null
        const list = Array.isArray(me?.blocking) ? (me!.blocking as string[]) : []
        const chain = new Set(list.filter((a): a is string => typeof a === 'string' && !!a))
        this.blocked = new Set(chain)
        // Поверх цепочки — блокировки, ждущие блока.
        channelsOf(this).blocks.reconcile((a) => chain.has(a))
      } catch (e) {
        console.warn('[userRelations] refresh failed', e)
      } finally {
        this.isLoading = false
      }
    },

    /** Перечитывает список подписок текущего пользователя (getusersubscribes). */
    async refreshSubscriptions(): Promise<void> {
      const address = useAuthStore().getUserAddress
      if (!address) return
      try {
        // legacy: api.rpc('getusersubscribes', [address, '', '', 0, 5000])
        const list = await rpcCall<RawSubscribe[]>({
          method: rpcEndpoints.getUserSubscribes,
          parameters: [address, '', '', 0, 5000],
          options: { auth: false },
        })
        const subscribed = new Set<string>()
        const subscribedPrivate = new Set<string>()
        if (Array.isArray(list)) {
          for (const item of list) {
            const addr = item?.adddress ?? item?.address
            if (typeof addr === 'string' && addr) {
              subscribed.add(addr)
              if (isPrivateSub(item.private)) subscribedPrivate.add(addr)
            }
          }
        }
        this.subscribed = new Set(subscribed)
        this.subscribedPrivate = new Set(subscribedPrivate)
        this.subscriptionsLoaded = true
        // Поверх цепочки — подписки, ждущие блока.
        channelsOf(this).subscriptions.reconcile((a) =>
          subscribed.has(a) ? (subscribedPrivate.has(a) ? 'private' : 'public') : 'none'
        )
      } catch (e) {
        console.warn('[userRelations] refreshSubscriptions failed', e)
      }
    },

    /**
     * Заблокировать адрес: сразу в интерфейсе, транзакция — сейчас или после
     * блока прошлой транзакции по этому адресу; откат при отказе.
     */
    async block(address: string): Promise<void> {
      await channelsOf(this).blocks.set(address, true)
    },

    /** Разблокировать адрес — так же, как block(). */
    async unblock(address: string): Promise<void> {
      await channelsOf(this).blocks.set(address, false)
    },

    /** Подписаться публично (или снять приватность, оставшись подписанным). */
    async subscribe(address: string): Promise<void> {
      await this.setSubscription(address, 'public')
    },

    /** Подписаться приватно (с уведомлениями). */
    async subscribePrivate(address: string): Promise<void> {
      await this.setSubscription(address, 'private')
    },

    /** Отписаться от пользователя. */
    async unsubscribe(address: string): Promise<void> {
      await this.setSubscription(address, 'none')
    },

    /**
     * Подписка как выбрал человек: сразу в интерфейсе, транзакция — сейчас или
     * после блока прошлой транзакции по этому адресу; откат при отказе.
     */
    async setSubscription(
      address: string,
      next: SubscriptionState
    ): Promise<'sent' | 'queued' | 'none'> {
      return channelsOf(this).subscriptions.set(address, next)
    },

    /**
     * Проверяет, заблокировал ли `authorAddress` текущего пользователя (#34).
     * Результат кешируется (checkedAuthors), чтобы не дёргать getuserprofile повторно.
     * Вызывать в момент реальной вовлечённости (фокус composer), а не на каждую карточку ленты.
     */
    async checkBannedBy(authorAddress: string): Promise<void> {
      const me = useAuthStore().getUserAddress
      if (!me || !authorAddress || authorAddress === me) return
      if (this.checkedAuthors.has(authorAddress)) return
      this.checkedAuthors.add(authorAddress)
      try {
        const arr = await rpcCall<UserProfile[]>({
          method: rpcEndpoints.getUserProfile,
          parameters: [[authorAddress]],
          options: { auth: false },
        })
        const prof = Array.isArray(arr)
          ? (arr.find((p) => p?.address === authorAddress) ?? arr[0])
          : null
        const blocking = Array.isArray(prof?.blocking) ? (prof!.blocking as string[]) : []
        if (blocking.includes(me)) this.bannedBy.add(authorAddress)
      } catch (e) {
        this.checkedAuthors.delete(authorAddress) // разрешаем повтор при сетевой ошибке
        console.warn('[userRelations] checkBannedBy failed', e)
      }
    },

    /** Сброс при разлогине. */
    reset(): void {
      const channels = channelsByStore.get(this)
      if (channels) {
        channels.stop()
        channelsByStore.delete(this)
      }
      initByStore.delete(this)
      this.blocked = new Set()
      this.pending = new Set()
      this.bannedBy = new Set()
      this.checkedAuthors = new Set()
      this.subscribed = new Set()
      this.subscribedPrivate = new Set()
      this.subscribePending = new Set()
      this.subscriptionsLoaded = false
      this.isInitialized = false
      this.isLoading = false
    },
  },
})
