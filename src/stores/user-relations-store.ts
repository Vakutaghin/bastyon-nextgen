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

/** Сырой элемент ответа getusersubscribes (терпим к опечатке adddress/address). */
type RawSubscribe = UserSubscribe & { address?: string }

/** Считает подписку приватной (legacy private: "true" | true | 1). */
function isPrivateSub(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
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
    async init(): Promise<void> {
      if (this.isInitialized) return
      this.isInitialized = true
      await Promise.all([this.refresh(), this.refreshSubscriptions()])
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
        this.blocked = new Set(list.filter((a): a is string => typeof a === 'string' && !!a))
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
        this.subscribed = subscribed
        this.subscribedPrivate = subscribedPrivate
      } catch (e) {
        console.warn('[userRelations] refreshSubscriptions failed', e)
      }
    },

    /** Заблокировать адрес: оптимистично + on-chain tx, откат при ошибке. */
    async block(address: string): Promise<void> {
      if (!address || this.pending.has(address) || this.blocked.has(address)) return
      this.pending.add(address)
      this.blocked.add(address)
      try {
        await blockUserTx(address)
      } catch (e) {
        this.blocked.delete(address)
        throw e
      } finally {
        this.pending.delete(address)
      }
    },

    /** Разблокировать адрес: оптимистично + on-chain tx, откат при ошибке. */
    async unblock(address: string): Promise<void> {
      if (!address || this.pending.has(address) || !this.blocked.has(address)) return
      this.pending.add(address)
      this.blocked.delete(address)
      try {
        await unblockUserTx(address)
      } catch (e) {
        this.blocked.add(address)
        throw e
      } finally {
        this.pending.delete(address)
      }
    },

    /** Подписаться публично (или снять приватность, оставшись подписанным). */
    async subscribe(address: string): Promise<void> {
      if (!address || this.subscribePending.has(address)) return
      // Уже подписан публично — нечего делать.
      if (this.subscribed.has(address) && !this.subscribedPrivate.has(address)) return
      await this.applySubscriptionChange(address, subscribeUserTx, 'public')
    },

    /** Подписаться приватно (с уведомлениями). */
    async subscribePrivate(address: string): Promise<void> {
      if (!address || this.subscribePending.has(address)) return
      // Уже приватно подписан — нечего делать.
      if (this.subscribed.has(address) && this.subscribedPrivate.has(address)) return
      await this.applySubscriptionChange(address, subscribeUserPrivateTx, 'private')
    },

    /** Отписаться от пользователя. */
    async unsubscribe(address: string): Promise<void> {
      if (!address || this.subscribePending.has(address)) return
      if (!this.subscribed.has(address)) return
      await this.applySubscriptionChange(address, unsubscribeUserTx, 'none')
    },

    /**
     * @internal Оптимистично применяет изменение подписки и шлёт on-chain tx;
     * при ошибке откатывает оба множества в исходное состояние.
     */
    async applySubscriptionChange(
      address: string,
      txFn: (a: string) => Promise<string>,
      nextState: 'public' | 'private' | 'none'
    ): Promise<void> {
      const wasSubscribed = this.subscribed.has(address)
      const wasPrivate = this.subscribedPrivate.has(address)
      this.subscribePending.add(address)
      if (nextState === 'none') {
        this.subscribed.delete(address)
        this.subscribedPrivate.delete(address)
      } else {
        this.subscribed.add(address)
        if (nextState === 'private') this.subscribedPrivate.add(address)
        else this.subscribedPrivate.delete(address)
      }
      try {
        await txFn(address)
      } catch (e) {
        if (wasSubscribed) this.subscribed.add(address)
        else this.subscribed.delete(address)
        if (wasPrivate) this.subscribedPrivate.add(address)
        else this.subscribedPrivate.delete(address)
        throw e
      } finally {
        this.subscribePending.delete(address)
      }
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
      this.blocked = new Set()
      this.pending = new Set()
      this.bannedBy = new Set()
      this.checkedAuthors = new Set()
      this.subscribed = new Set()
      this.subscribedPrivate = new Set()
      this.subscribePending = new Set()
      this.isInitialized = false
      this.isLoading = false
    },
  },
})
